const bcrypt = require('bcrypt');
const pool = require('../../config/db');
const { buildSort, buildMeta } = require('../../utils/pagination');
const policyService = require('../leave-policies/service');

const SALT_ROUNDS = 10;
const ALLOWED_SORT_COLUMNS = ['first_name', 'last_name', 'created_at'];

async function getManagedDepartmentIds(companyId, employeeId) {
  if (!employeeId) return [];
  const result = await pool.query(
    'SELECT id FROM departments WHERE company_id = $1 AND manager_id = $2',
    [companyId, employeeId]
  );
  return result.rows.map((row) => row.id);
}

async function canViewEmployee(user, employeeId) {
  const employee = await getEmployee(user.companyId, employeeId);
  if (!employee) return false;

  if (user.role === 'admin') return true;
  if (Number(employeeId) === Number(user.employeeId)) return true;

  if (user.role === 'manager') {
    const departmentIds = await getManagedDepartmentIds(user.companyId, user.employeeId);
    return departmentIds.includes(employee.department_id);
  }
  return false;
}

async function listEmployees(user, { search, departmentId, sort, page, limit, offset }) {
  const orderBy = buildSort({ sort }, ALLOWED_SORT_COLUMNS, 'first_name:asc');

  const filters = ['e.company_id = $1'];
  const params = [user.companyId];


  if (user.role === 'manager') {
    const departmentIds = await getManagedDepartmentIds(user.companyId, user.employeeId);
    if (departmentIds.length === 0) {
      return { data: [], meta: buildMeta(0, page, limit) };
    }
    params.push(departmentIds);
    filters.push(`e.department_id = ANY($${params.length}::int[])`);
  }

  if (departmentId) {
    params.push(departmentId);
    filters.push(`e.department_id = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    filters.push(`(e.first_name ILIKE $${params.length} OR e.last_name ILIKE $${params.length})`);
  }

  const where = filters.join(' AND ');

  const dataResult = await pool.query(
    `SELECT e.id, e.first_name, e.last_name, e.department_id, e.created_at,
            u.email, u.role, d.name AS department_name
     FROM employees e
     LEFT JOIN users u ON u.id = e.user_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE ${where}
     ORDER BY e.${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM employees e WHERE ${where}`,
    params
  );

  const total = parseInt(countResult.rows[0].count, 10);
  return { data: dataResult.rows, meta: buildMeta(total, page, limit) };
}

async function getEmployee(companyId, employeeId) {
  const result = await pool.query(
    `SELECT e.id, e.company_id, e.first_name, e.last_name, e.department_id, e.user_id, e.created_at,
            u.email, u.role, d.name AS department_name
     FROM employees e
     LEFT JOIN users u ON u.id = e.user_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.company_id = $1 AND e.id = $2`,
    [companyId, employeeId]
  );
  return result.rows[0];
}

async function createEmployee(companyId, { firstName, lastName, email, password, departmentId, role, annualDays }) {
  const client = await pool.connect();
  const year = new Date().getFullYear();

  try {
    await client.query('BEGIN');

    if (departmentId) {
      const dept = await client.query(
        'SELECT id FROM departments WHERE company_id = $1 AND id = $2',
        [companyId, departmentId]
      );
      if (!dept.rows[0]) {
        const err = new Error('That department does not exist in your company');
        err.status = 400;
        throw err;
      }
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const userResult = await client.query(
      `INSERT INTO users (company_id, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role`,
      [companyId, email, passwordHash, role || 'employee']
    );
    const user = userResult.rows[0];

    const employeeResult = await client.query(
      `INSERT INTO employees (company_id, department_id, first_name, last_name, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [companyId, departmentId || null, firstName, lastName, user.id]
    );
    const employee = employeeResult.rows[0];

    const policy = await policyService.getPolicy(companyId);
    const days = annualDays || policy.default_annual_days;

    await client.query(
      `INSERT INTO leave_balance (company_id, employee_id, year, total_days, used_days, remaining_days, is_active)
       VALUES ($1, $2, $3, $4, 0, $4, true)`,
      [companyId, employee.id, year, days]
    );

    await client.query('COMMIT');
    return { ...employee, email: user.email, role: user.role, annualDays: days };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      const conflict = new Error('Someone in your company already uses that email address');
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  } finally {
    client.release();
  }
}

async function updateEmployee(companyId, employeeId, { firstName, lastName, departmentId }) {
  const existing = await getEmployee(companyId, employeeId);
  if (!existing) return null;

  if (departmentId) {
    const dept = await pool.query(
      'SELECT id FROM departments WHERE company_id = $1 AND id = $2',
      [companyId, departmentId]
    );
    if (!dept.rows[0]) {
      const err = new Error('That department does not exist in your company');
      err.status = 400;
      throw err;
    }
  }

  const result = await pool.query(
    `UPDATE employees
     SET first_name = $1, last_name = $2, department_id = $3
     WHERE company_id = $4 AND id = $5
     RETURNING *`,
    [
      firstName || existing.first_name,
      lastName || existing.last_name,
      departmentId === undefined ? existing.department_id : departmentId,
      companyId,
      employeeId,
    ]
  );
  return result.rows[0];
}

async function changeRole(companyId, employeeId, role) {
  const employee = await getEmployee(companyId, employeeId);
  if (!employee || !employee.user_id) return null;

  const result = await pool.query(
    `UPDATE users SET role = $1 WHERE company_id = $2 AND id = $3
     RETURNING id, email, role`,
    [role, companyId, employee.user_id]
  );
  return result.rows[0];
}

async function countEmployees(companyId) {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS total FROM employees WHERE company_id = $1',
    [companyId]
  );
  return result.rows[0].total;
}

module.exports = {
  getManagedDepartmentIds,
  canViewEmployee,
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  changeRole,
  countEmployees,
};
