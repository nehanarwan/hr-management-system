const pool = require('../../config/db');
const employeeService = require('../employees/service');

async function getCalendar(user, { from, to, departmentId, scope }) {
  const filters = ["lr.company_id = $1", "lr.status = 'Approved'", 'lr.end_date >= $2', 'lr.start_date <= $3'];
  const params = [user.companyId, from, to];

  if (scope === 'team' && user.role === 'manager') {
    const departmentIds = await employeeService.getManagedDepartmentIds(user.companyId, user.employeeId);
    if (departmentIds.length === 0) return [];
    params.push(departmentIds);
    filters.push(`e.department_id = ANY($${params.length}::int[])`);
  }

  if (departmentId) {
    params.push(departmentId);
    filters.push(`e.department_id = $${params.length}`);
  }

  const result = await pool.query(
    `SELECT lr.id, lr.employee_id, lr.start_date, lr.end_date, lr.total_days,
            e.first_name, e.last_name, d.name AS department_name
     FROM leave_request lr
     INNER JOIN employees e ON e.id = lr.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE ${filters.join(' AND ')}
     ORDER BY lr.start_date ASC`,
    params
  );
  return result.rows;
}

async function getWhoIsOutToday(companyId) {
  const result = await pool.query(
    `SELECT lr.id, e.id AS employee_id, e.first_name, e.last_name, d.name AS department_name,
            lr.start_date, lr.end_date
     FROM leave_request lr
     INNER JOIN employees e ON e.id = lr.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE lr.company_id = $1 AND lr.status = 'Approved'
       AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
     ORDER BY e.first_name`,
    [companyId]
  );
  return result.rows;
}

async function getCompanyStats(companyId) {
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM employees WHERE company_id = $1) AS employee_count,
       (SELECT COUNT(*)::int FROM departments WHERE company_id = $1) AS department_count,
       (SELECT COUNT(*)::int FROM leave_request WHERE company_id = $1 AND status = 'Pending') AS pending_count,
       (SELECT COUNT(*)::int FROM leave_request WHERE company_id = $1 AND status = 'Approved') AS approved_count,
       (SELECT COUNT(*)::int FROM leave_request WHERE company_id = $1 AND status = 'Rejected') AS rejected_count,
       (SELECT COUNT(*)::int FROM leave_request
         WHERE company_id = $1 AND status = 'Approved'
           AND CURRENT_DATE BETWEEN start_date AND end_date) AS on_leave_today,
       (SELECT COALESCE(SUM(used_days), 0)::int FROM leave_balance
         WHERE company_id = $1 AND year = EXTRACT(YEAR FROM CURRENT_DATE)) AS days_used_this_year`,
    [companyId]
  );
  return result.rows[0];
}

module.exports = { getCalendar, getWhoIsOutToday, getCompanyStats };
