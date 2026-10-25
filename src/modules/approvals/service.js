const pool = require('../../config/db');
const { buildSort, buildMeta } = require('../../utils/pagination');
const dates = require('../../utils/dates');
const balanceService = require('../leave-balance/service');
const requestService = require('../leave-request/service');
const employeeService = require('../employees/service');

const ALLOWED_SORT_COLUMNS = ['created_at', 'status'];

async function canReview(user, request) {
  if (!request) return { allowed: false, reason: 'not_found' };

  if (Number(request.employee_id) === Number(user.employeeId)) {
    return { allowed: false, reason: 'own_request' };
  }

  if (user.role === 'admin') return { allowed: true };

  if (user.role === 'manager') {
    const departmentIds = await employeeService.getManagedDepartmentIds(user.companyId, user.employeeId);
    if (departmentIds.includes(request.department_id)) return { allowed: true };
  }

  return { allowed: false, reason: 'not_found' };
}

async function approveRequest(user, requestId, comment) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const requestResult = await client.query(
      `SELECT lr.*, e.department_id
       FROM leave_request lr
       INNER JOIN employees e ON e.id = lr.employee_id
       WHERE lr.company_id = $1 AND lr.id = $2
       FOR UPDATE OF lr`,
      [user.companyId, requestId]
    );
    const request = requestResult.rows[0];

    if (!request) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not_found' };
    }
    if (request.status !== 'Pending') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not_pending', status: request.status };
    }

    const year = dates.yearOf(request.start_date);
    const balance = await balanceService.lockBalanceForUpdate(
      client,
      user.companyId,
      request.employee_id,
      year
    );

    if (!balance) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'no_balance', year };
    }

  
    const remaining = balance.total_days - balance.used_days;
    if (request.total_days > remaining) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'insufficient', remaining, requested: request.total_days };
    }

    await balanceService.addUsedDays(client, user.companyId, request.employee_id, year, request.total_days);

    const updated = await client.query(
      `UPDATE leave_request
       SET status = 'Approved', reviewer_id = $1, reviewer_comment = $2,
           reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE company_id = $3 AND id = $4
       RETURNING *`,
      [user.employeeId, comment || null, user.companyId, requestId]
    );

    await client.query(
      `INSERT INTO request_response (company_id, reviewer_id, leave_request_id, head_comment, status)
       VALUES ($1, $2, $3, $4, 'Approved')`,
      [user.companyId, user.employeeId, requestId, comment || null]
    );

    await client.query('COMMIT');
    return { ok: true, request: updated.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function rejectRequest(user, requestId, reason) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const requestResult = await client.query(
      `SELECT * FROM leave_request WHERE company_id = $1 AND id = $2 FOR UPDATE`,
      [user.companyId, requestId]
    );
    const request = requestResult.rows[0];

    if (!request) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not_found' };
    }
    if (request.status !== 'Pending') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not_pending', status: request.status };
    }

    const updated = await client.query(
      `UPDATE leave_request
       SET status = 'Rejected', reviewer_id = $1, reviewer_comment = $2,
           reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE company_id = $3 AND id = $4
       RETURNING *`,
      [user.employeeId, reason, user.companyId, requestId]
    );

    await client.query(
      `INSERT INTO request_response (company_id, reviewer_id, leave_request_id, head_comment, status)
       VALUES ($1, $2, $3, $4, 'Rejected')`,
      [user.companyId, user.employeeId, requestId, reason]
    );

    await client.query('COMMIT');
    return { ok: true, request: updated.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}


async function listApprovalHistory(user, { sort, page, limit, offset }) {
  const orderBy = buildSort({ sort }, ALLOWED_SORT_COLUMNS, 'created_at:desc');

  const filters = ['rr.company_id = $1'];
  const params = [user.companyId];

  if (user.role === 'manager') {
    const departmentIds = await employeeService.getManagedDepartmentIds(user.companyId, user.employeeId);
    if (departmentIds.length === 0) {
      return { data: [], meta: buildMeta(0, page, limit) };
    }
    params.push(departmentIds);
    filters.push(`e.department_id = ANY($${params.length}::int[])`);
  }

  const where = filters.join(' AND ');

  const dataResult = await pool.query(
    `SELECT rr.id, rr.status, rr.head_comment, rr.created_at,
            lr.id AS leave_request_id, lr.start_date, lr.end_date, lr.total_days,
            e.first_name, e.last_name, d.name AS department_name,
            reviewer.first_name AS reviewer_first_name, reviewer.last_name AS reviewer_last_name
     FROM request_response rr
     INNER JOIN leave_request lr ON lr.id = rr.leave_request_id
     INNER JOIN employees e ON e.id = lr.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN employees reviewer ON reviewer.id = rr.reviewer_id
     WHERE ${where}
     ORDER BY rr.${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const countResult = await pool.query(
    `SELECT COUNT(*)
     FROM request_response rr
     INNER JOIN leave_request lr ON lr.id = rr.leave_request_id
     INNER JOIN employees e ON e.id = lr.employee_id
     WHERE ${where}`,
    params
  );

  const total = parseInt(countResult.rows[0].count, 10);
  return { data: dataResult.rows, meta: buildMeta(total, page, limit) };
}


async function getRequestHistory(user, requestId) {
  const request = await requestService.getRequestById(user.companyId, requestId);
  const allowed = await requestService.canViewRequest(user, request);
  if (!allowed) return null;

  const result = await pool.query(
    `SELECT rr.*, e.first_name AS reviewer_first_name, e.last_name AS reviewer_last_name
     FROM request_response rr
     LEFT JOIN employees e ON e.id = rr.reviewer_id
     WHERE rr.company_id = $1 AND rr.leave_request_id = $2
     ORDER BY rr.created_at ASC`,
    [user.companyId, requestId]
  );
  return result.rows;
}

module.exports = { canReview, approveRequest, rejectRequest, listApprovalHistory, getRequestHistory };
