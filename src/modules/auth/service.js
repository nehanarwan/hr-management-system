const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');
const env = require('../../config/env');

const SALT_ROUNDS = 10;

async function registerCompanyWithAdmin({ companyName, companySlug, email, password, firstName, lastName }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const companyResult = await client.query(
      'INSERT INTO companies (name, slug) VALUES ($1, $2) RETURNING id, name, slug',
      [companyName, companySlug]
    );
    const company = companyResult.rows[0];

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const userResult = await client.query(
      `INSERT INTO users (company_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, email, role, company_id`,
      [company.id, email, passwordHash]
    );
    const user = userResult.rows[0];

    const employeeResult = await client.query(
      `INSERT INTO employees (company_id, first_name, last_name, user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, first_name, last_name`,
      [company.id, firstName, lastName, user.id]
    );
    const employee = employeeResult.rows[0];

    await client.query('INSERT INTO leave_policies (company_id) VALUES ($1)', [company.id]);

    await client.query('COMMIT');
    return { company, user, employee };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      const conflict = new Error(
        err.constraint === 'companies_slug_unique'
          ? 'That company slug is already taken'
          : 'That record already exists'
      );
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  } finally {
    client.release();
  }
}

// The tenant is part of the login, so two companies can both have alice@example.com.
async function findUserForLogin(companySlug, email) {
  const result = await pool.query(
    `SELECT u.id, u.company_id, u.email, u.password_hash, u.role,
            c.slug AS company_slug, c.name AS company_name,
            e.id AS employee_id, e.department_id, e.first_name, e.last_name,
            d.name AS department_name
     FROM users u
     INNER JOIN companies c ON c.id = u.company_id
     LEFT JOIN employees e ON e.user_id = u.id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE c.slug = $1 AND u.email = $2
     LIMIT 1`,
    [companySlug, email]
  );
  return result.rows[0];
}

async function login({ companySlug, email, password }) {
  const user = await findUserForLogin(companySlug, email);

  // Same message either way, so the response cannot be used to discover
  // which email addresses exist.
  const invalid = new Error('Email or password is incorrect');
  invalid.status = 401;

  if (!user) throw invalid;

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) throw invalid;

  const token = jwt.sign(
    {
      userId: user.id,
      companyId: user.company_id,
      employeeId: user.employee_id,
      departmentId: user.department_id,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  return { token, user: publicUser(user) };
}

// Everything the frontend is allowed to know about the logged in user.
async function getMe(companyId, userId) {
  const result = await pool.query(
    `SELECT u.id, u.company_id, u.email, u.role,
            c.slug AS company_slug, c.name AS company_name,
            e.id AS employee_id, e.department_id, e.first_name, e.last_name,
            d.name AS department_name
     FROM users u
     INNER JOIN companies c ON c.id = u.company_id
     LEFT JOIN employees e ON e.user_id = u.id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE u.company_id = $1 AND u.id = $2`,
    [companyId, userId]
  );

  if (!result.rows[0]) return null;
  return publicUser(result.rows[0]);
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    companyId: row.company_id,
    companySlug: row.company_slug,
    companyName: row.company_name,
    employeeId: row.employee_id,
    departmentId: row.department_id,
    firstName: row.first_name,
    lastName: row.last_name,
    departmentName: row.department_name || null,
  };
}

module.exports = { registerCompanyWithAdmin, login, getMe };
