const pool = require('../../config/db');
const { buildSort, buildMeta } = require('../../utils/pagination');

const ALLOWED_SORT_COLUMNS = ['name', 'created_at'];

async function listDepartments(companyId, { search, sort, page, limit, offset }) {
  const orderBy = buildSort({ sort }, ALLOWED_SORT_COLUMNS, 'name:asc');

  const filters = ['d.company_id = $1'];
  const params = [companyId];

  if (search) {
    params.push(`%${search}%`);
    filters.push(`d.name ILIKE $${params.length}`);
  }
  const where = filters.join(' AND ');

  const dataResult = await pool.query(
    `SELECT d.id, d.name, d.manager_id, d.created_at,
            m.first_name AS manager_first_name, m.last_name AS manager_last_name,
            (SELECT COUNT(*)::int FROM employees e WHERE e.department_id = d.id) AS employee_count
     FROM departments d
     LEFT JOIN employees m ON m.id = d.manager_id
     WHERE ${where}
     ORDER BY d.${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const countResult = await pool.query(`SELECT COUNT(*) FROM departments d WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  return { data: dataResult.rows, meta: buildMeta(total, page, limit) };
}

async function getDepartment(companyId, departmentId) {
  const result = await pool.query(
    `SELECT d.id, d.name, d.manager_id, d.created_at,
            m.first_name AS manager_first_name, m.last_name AS manager_last_name,
            (SELECT COUNT(*)::int FROM employees e WHERE e.department_id = d.id) AS employee_count
     FROM departments d
     LEFT JOIN employees m ON m.id = d.manager_id
     WHERE d.company_id = $1 AND d.id = $2`,
    [companyId, departmentId]
  );
  return result.rows[0];
}

async function createDepartment(companyId, { name }) {
  try {
    const result = await pool.query(
      'INSERT INTO departments (company_id, name) VALUES ($1, $2) RETURNING *',
      [companyId, name]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      const conflict = new Error('Your company already has a department with that name');
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  }
}

async function updateDepartment(companyId, departmentId, { name }) {
  try {
    const result = await pool.query(
      'UPDATE departments SET name = $1 WHERE company_id = $2 AND id = $3 RETURNING *',
      [name, companyId, departmentId]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      const conflict = new Error('Your company already has a department with that name');
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  }
}

async function deleteDepartment(companyId, departmentId) {
  const result = await pool.query(
    'DELETE FROM departments WHERE company_id = $1 AND id = $2 RETURNING *',
    [companyId, departmentId]
  );
  return result.rows[0];
}


async function assignManager(companyId, departmentId, employeeId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const employeeResult = await client.query(
      'SELECT id, user_id FROM employees WHERE company_id = $1 AND id = $2',
      [companyId, employeeId]
    );
    const employee = employeeResult.rows[0];

    if (!employee) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'employee_not_found' };
    }

    const departmentResult = await client.query(
      'UPDATE departments SET manager_id = $1 WHERE company_id = $2 AND id = $3 RETURNING *',
      [employeeId, companyId, departmentId]
    );

    if (!departmentResult.rows[0]) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'department_not_found' };
    }

    if (employee.user_id) {
      await client.query(
        "UPDATE users SET role = 'manager' WHERE company_id = $1 AND id = $2 AND role <> 'admin'",
        [companyId, employee.user_id]
      );
    }

    await client.query('COMMIT');
    return { ok: true, department: departmentResult.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function removeManager(companyId, departmentId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const current = await client.query(
      'SELECT manager_id FROM departments WHERE company_id = $1 AND id = $2',
      [companyId, departmentId]
    );
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'department_not_found' };
    }

    const previousManagerId = current.rows[0].manager_id;

    const updated = await client.query(
      'UPDATE departments SET manager_id = NULL WHERE company_id = $1 AND id = $2 RETURNING *',
      [companyId, departmentId]
    );

    if (previousManagerId) {
      const stillManages = await client.query(
        'SELECT COUNT(*)::int AS total FROM departments WHERE company_id = $1 AND manager_id = $2',
        [companyId, previousManagerId]
      );

      if (stillManages.rows[0].total === 0) {
        await client.query(
          `UPDATE users SET role = 'employee'
           WHERE company_id = $1
             AND id = (SELECT user_id FROM employees WHERE company_id = $1 AND id = $2)
             AND role = 'manager'`,
          [companyId, previousManagerId]
        );
      }
    }

    await client.query('COMMIT');
    return { ok: true, department: updated.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listManagers(companyId) {
  const result = await pool.query(
    `SELECT e.id, e.first_name, e.last_name, u.email,
            ARRAY_REMOVE(ARRAY_AGG(d.name), NULL) AS departments
     FROM employees e
     INNER JOIN users u ON u.id = e.user_id
     LEFT JOIN departments d ON d.manager_id = e.id
     WHERE e.company_id = $1 AND u.role = 'manager'
     GROUP BY e.id, e.first_name, e.last_name, u.email
     ORDER BY e.first_name`,
    [companyId]
  );
  return result.rows;
}

module.exports = {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  assignManager,
  removeManager,
  listManagers,
};
