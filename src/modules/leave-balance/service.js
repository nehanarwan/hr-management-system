const pool = require('../../config/db');
const { buildSort, buildMeta } = require('../../utils/pagination');
const policyService = require('../leave-policies/service');

const ALLOWED_SORT_COLUMNS = ['year', 'total_days', 'used_days', 'remaining_days'];

async function getSummary(companyId, employeeId, year) {
  const balanceResult = await pool.query(
    `SELECT * FROM leave_balance
     WHERE company_id = $1 AND employee_id = $2 AND year = $3`,
    [companyId, employeeId, year]
  );
  const balance = balanceResult.rows[0];

  const pendingResult = await pool.query(
    `SELECT COALESCE(SUM(total_days), 0)::int AS pending_days
     FROM leave_request
     WHERE company_id = $1 AND employee_id = $2 AND status = 'Pending'
       AND EXTRACT(YEAR FROM start_date) = $3`,
    [companyId, employeeId, year]
  );
  const pending = pendingResult.rows[0].pending_days;

  if (!balance) {
    return { year: Number(year), entitlement: 0, used: 0, pending, remaining: 0, requestable: 0, hasBalance: false };
  }

  const entitlement = balance.total_days;
  const used = balance.used_days;

  return {
    year: Number(year),
    entitlement,
    used,
    pending,
    remaining: entitlement - used,
    requestable: Math.max(entitlement - used - pending, 0),
    hasBalance: true,
  };
}

async function getRequestableDays(companyId, employeeId, year) {
  const summary = await getSummary(companyId, employeeId, year);
  return summary.requestable;
}

async function listBalances(companyId, { year, sort, page, limit, offset }) {
  const orderBy = buildSort({ sort }, ALLOWED_SORT_COLUMNS, 'year:desc');

  const filters = ['lb.company_id = $1'];
  const params = [companyId];

  if (year) {
    params.push(year);
    filters.push(`lb.year = $${params.length}`);
  }
  const where = filters.join(' AND ');

  const dataResult = await pool.query(
    `SELECT lb.*, e.first_name, e.last_name, d.name AS department_name
     FROM leave_balance lb
     INNER JOIN employees e ON e.id = lb.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE ${where}
     ORDER BY lb.${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM leave_balance lb WHERE ${where}`,
    params
  );

  const total = parseInt(countResult.rows[0].count, 10);
  return { data: dataResult.rows, meta: buildMeta(total, page, limit) };
}

async function getBalance(companyId, employeeId, year) {
  const result = await pool.query(
    `SELECT * FROM leave_balance
     WHERE company_id = $1 AND employee_id = $2 AND year = $3`,
    [companyId, employeeId, year]
  );
  return result.rows[0];
}

async function createBalance(companyId, employeeId, year, totalDays) {
  const currentYear = new Date().getFullYear();
  try {
    const result = await pool.query(
      `INSERT INTO leave_balance (company_id, employee_id, year, total_days, used_days, remaining_days, is_active)
       VALUES ($1, $2, $3, $4, 0, $4, $5)
       RETURNING *`,
      [companyId, employeeId, year, totalDays, Number(year) === currentYear]
    );
    return result.rows[0];
  } catch (err) {

    if (err.code === '23505') {
      const conflict = new Error('This employee already has an entitlement for that year');
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  }
}

async function updateBalance(companyId, employeeId, year, totalDays) {
  const existing = await getBalance(companyId, employeeId, year);
  if (!existing) return null;

  if (totalDays < existing.used_days) {
    const err = new Error(
      `Entitlement cannot be lower than the ${existing.used_days} days already approved`
    );
    err.status = 400;
    throw err;
  }

  const result = await pool.query(
    `UPDATE leave_balance
     SET total_days = $1, remaining_days = $1 - used_days
     WHERE company_id = $2 AND employee_id = $3 AND year = $4
     RETURNING *`,
    [totalDays, companyId, employeeId, year]
  );
  return result.rows[0];
}


async function deactivateBalance(companyId, employeeId, year) {
  const result = await pool.query(
    `UPDATE leave_balance SET is_active = false
     WHERE company_id = $1 AND employee_id = $2 AND year = $3
     RETURNING *`,
    [companyId, employeeId, year]
  );
  return result.rows[0];
}

async function ensureBalanceForYear(companyId, employeeId, year) {
  const existing = await getBalance(companyId, employeeId, year);
  if (existing) return existing;

  const policy = await policyService.getPolicy(companyId);
  return createBalance(companyId, employeeId, year, policy.default_annual_days);
}


async function lockBalanceForUpdate(client, companyId, employeeId, year) {
  const result = await client.query(
    `SELECT * FROM leave_balance
     WHERE company_id = $1 AND employee_id = $2 AND year = $3
     FOR UPDATE`,
    [companyId, employeeId, year]
  );
  return result.rows[0];
}

async function addUsedDays(client, companyId, employeeId, year, days) {
  const result = await client.query(
    `UPDATE leave_balance
     SET used_days = used_days + $1, remaining_days = total_days - (used_days + $1)
     WHERE company_id = $2 AND employee_id = $3 AND year = $4
     RETURNING *`,
    [days, companyId, employeeId, year]
  );
  return result.rows[0];
}

module.exports = {
  getSummary,
  getRequestableDays,
  listBalances,
  getBalance,
  createBalance,
  updateBalance,
  deactivateBalance,
  ensureBalanceForYear,
  lockBalanceForUpdate,
  addUsedDays,
};
