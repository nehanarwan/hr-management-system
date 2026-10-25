const pool = require('../../config/db');
const { buildSort, buildMeta } = require('../../utils/pagination');
const dates = require('../../utils/dates');
const balanceService = require('../leave-balance/service');
const policyService = require('../leave-policies/service');
const employeeService = require('../employees/service');

const ALLOWED_SORT_COLUMNS = ['start_date', 'end_date', 'status', 'created_at', 'total_days'];

const SELECT_REQUEST = `
  SELECT lr.*,
         e.first_name, e.last_name, e.department_id,
         d.name AS department_name,
         r.first_name AS reviewer_first_name, r.last_name AS reviewer_last_name
  FROM leave_request lr
  INNER JOIN employees e ON e.id = lr.employee_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN employees r ON r.id = lr.reviewer_id
`;


async function calculateDays(companyId, startDate, endDate) {
  const rules = await policyService.getLeaveRules(companyId, dates.yearOf(startDate));
  return dates.countLeaveDays(startDate, endDate, rules);
}

async function findOverlapping(companyId, employeeId, startDate, endDate, ignoreRequestId) {
  const params = [companyId, employeeId, startDate, endDate];
  let sql = `
    SELECT id, start_date, end_date, status
    FROM leave_request
    WHERE company_id = $1 AND employee_id = $2
      AND status IN ('Pending', 'Approved')
      AND start_date <= $4 AND end_date >= $3
  `;
  if (ignoreRequestId) {
    params.push(ignoreRequestId);
    sql += ` AND id <> $${params.length}`;
  }
  const result = await pool.query(sql, params);
  return result.rows[0];
}

async function validateRequest(companyId, employeeId, startDate, endDate, ignoreRequestId) {
  if (dates.toDate(startDate) > dates.toDate(endDate)) {
    throw badRequest('The end date cannot be before the start date');
  }

  if (dates.yearOf(startDate) !== dates.yearOf(endDate)) {
    throw badRequest('A leave request cannot span two years. Please create one request per year.');
  }

  const year = dates.yearOf(startDate);
  const policy = await policyService.getPolicy(companyId);
  const totalDays = await calculateDays(companyId, startDate, endDate);

  if (totalDays < 1) {
    throw badRequest('Those dates contain no working days');
  }

  if (totalDays > policy.max_consecutive_days) {
    throw badRequest(`You cannot request more than ${policy.max_consecutive_days} days in a row`);
  }

  if (policy.min_notice_days > 0) {
    const today = dates.toDate(new Date());
    const earliest = new Date(today);
    earliest.setUTCDate(earliest.getUTCDate() + policy.min_notice_days);
    if (dates.toDate(startDate) < earliest) {
      throw badRequest(`Leave must be requested at least ${policy.min_notice_days} days in advance`);
    }
  }

  const clash = await findOverlapping(companyId, employeeId, startDate, endDate, ignoreRequestId);
  if (clash) {
    throw badRequest(
      `You already have a ${clash.status.toLowerCase()} request from ${dates.toISO(clash.start_date)} to ${dates.toISO(clash.end_date)}`
    );
  }

  const summary = await balanceService.getSummary(companyId, employeeId, year);
  if (!summary.hasBalance) {
    throw badRequest(`You do not have a leave entitlement for ${year} yet. Ask your administrator to set one.`);
  }

  let available = summary.requestable;
  if (ignoreRequestId) {
    const own = await pool.query(
      `SELECT total_days FROM leave_request
       WHERE company_id = $1 AND id = $2 AND status = 'Pending'`,
      [companyId, ignoreRequestId]
    );
    if (own.rows[0]) available += own.rows[0].total_days;
  }

  if (totalDays > available) {
    throw badRequest(
      `Not enough leave available. You can still request ${available} day(s) (${summary.remaining} remaining, ${summary.pending} already pending).`
    );
  }

  return totalDays;
}

async function createRequest(companyId, employeeId, { startDate, endDate, reason }) {
  const totalDays = await validateRequest(companyId, employeeId, startDate, endDate);

  const result = await pool.query(
    `INSERT INTO leave_request (company_id, employee_id, start_date, end_date, total_days, user_comment, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'Pending')
     RETURNING *`,
    [companyId, employeeId, startDate, endDate, totalDays, reason]
  );
  return result.rows[0];
}

async function updateRequest(companyId, employeeId, requestId, { startDate, endDate, reason }) {
  const existing = await getRequestById(companyId, requestId);
  if (!existing) return null;

  if (Number(existing.employee_id) !== Number(employeeId)) {
    throw forbidden('You can only edit your own leave requests');
  }
  if (existing.status !== 'Pending') {
    throw badRequest('Only pending requests can be edited');
  }

  const totalDays = await validateRequest(companyId, employeeId, startDate, endDate, requestId);

  const result = await pool.query(
    `UPDATE leave_request
     SET start_date = $1, end_date = $2, total_days = $3, user_comment = $4, updated_at = CURRENT_TIMESTAMP
     WHERE company_id = $5 AND id = $6
     RETURNING *`,
    [startDate, endDate, totalDays, reason, companyId, requestId]
  );
  return result.rows[0];
}

async function cancelRequest(companyId, employeeId, requestId) {
  const existing = await getRequestById(companyId, requestId);
  if (!existing) return null;

  if (Number(existing.employee_id) !== Number(employeeId)) {
    throw forbidden('You can only cancel your own leave requests');
  }
  if (existing.status !== 'Pending') {
    throw badRequest('Only pending requests can be cancelled');
  }

  const result = await pool.query(
    `UPDATE leave_request
     SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
     WHERE company_id = $1 AND id = $2
     RETURNING *`,
    [companyId, requestId]
  );
  return result.rows[0];
}

async function getRequestById(companyId, requestId) {
  const result = await pool.query(`${SELECT_REQUEST} WHERE lr.company_id = $1 AND lr.id = $2`, [
    companyId,
    requestId,
  ]);
  return result.rows[0];
}


async function canViewRequest(user, request) {
  if (!request) return false;
  if (user.role === 'admin') return true;
  if (Number(request.employee_id) === Number(user.employeeId)) return true;
  if (user.role === 'manager') {
    const departmentIds = await employeeService.getManagedDepartmentIds(user.companyId, user.employeeId);
    return departmentIds.includes(request.department_id);
  }
  return false;
}

async function listMyRequests(companyId, employeeId, { status, sort, page, limit, offset }) {
  const filters = ['lr.company_id = $1', 'lr.employee_id = $2'];
  const params = [companyId, employeeId];

  if (status) {
    params.push(status);
    filters.push(`lr.status = $${params.length}`);
  }

  return runListQuery(filters.join(' AND '), params, { sort, page, limit, offset });
}

async function listTeamRequests(user, { status, sort, page, limit, offset }) {
  const filters = ['lr.company_id = $1'];
  const params = [user.companyId];

  if (user.role === 'manager') {
    const departmentIds = await employeeService.getManagedDepartmentIds(user.companyId, user.employeeId);
    if (departmentIds.length === 0) {
      return { data: [], meta: buildMeta(0, page, limit) };
    }
    params.push(departmentIds);
    filters.push(`e.department_id = ANY($${params.length}::int[])`);
    params.push(user.employeeId);
    filters.push(`lr.employee_id <> $${params.length}`);
  }

  if (status) {
    params.push(status);
    filters.push(`lr.status = $${params.length}`);
  }

  return runListQuery(filters.join(' AND '), params, { sort, page, limit, offset });
}

async function runListQuery(where, params, { sort, page, limit, offset }) {
  const orderBy = buildSort({ sort }, ALLOWED_SORT_COLUMNS, 'created_at:desc');

  const dataResult = await pool.query(
    `${SELECT_REQUEST} WHERE ${where}
     ORDER BY lr.${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const countResult = await pool.query(
    `SELECT COUNT(*)
     FROM leave_request lr
     INNER JOIN employees e ON e.id = lr.employee_id
     WHERE ${where}`,
    params
  );

  const total = parseInt(countResult.rows[0].count, 10);
  return { data: dataResult.rows, meta: buildMeta(total, page, limit) };
}

async function getUpcomingLeave(companyId, employeeId) {
  const result = await pool.query(
    `SELECT * FROM leave_request
     WHERE company_id = $1 AND employee_id = $2 AND status = 'Approved' AND end_date >= CURRENT_DATE
     ORDER BY start_date ASC`,
    [companyId, employeeId]
  );
  return result.rows;
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function forbidden(message) {
  const err = new Error(message);
  err.status = 403;
  return err;
}

module.exports = {
  calculateDays,
  findOverlapping,
  validateRequest,
  createRequest,
  updateRequest,
  cancelRequest,
  getRequestById,
  canViewRequest,
  listMyRequests,
  listTeamRequests,
  getUpcomingLeave,
};
