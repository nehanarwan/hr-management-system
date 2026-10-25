const pool = require('../../config/db');

async function getPolicy(companyId) {
  const result = await pool.query('SELECT * FROM leave_policies WHERE company_id = $1', [companyId]);
  if (result.rows[0]) return result.rows[0];

  const created = await pool.query(
    'INSERT INTO leave_policies (company_id) VALUES ($1) RETURNING *',
    [companyId]
  );
  return created.rows[0];
}

async function updatePolicy(companyId, fields) {
  const current = await getPolicy(companyId);

  const merged = {
    default_annual_days: pick(fields.defaultAnnualDays, current.default_annual_days),
    exclude_weekends: pick(fields.excludeWeekends, current.exclude_weekends),
    exclude_holidays: pick(fields.excludeHolidays, current.exclude_holidays),
    min_notice_days: pick(fields.minNoticeDays, current.min_notice_days),
    max_consecutive_days: pick(fields.maxConsecutiveDays, current.max_consecutive_days),
  };

  const result = await pool.query(
    `UPDATE leave_policies
     SET default_annual_days = $1, exclude_weekends = $2, exclude_holidays = $3,
         min_notice_days = $4, max_consecutive_days = $5, updated_at = CURRENT_TIMESTAMP
     WHERE company_id = $6
     RETURNING *`,
    [
      merged.default_annual_days,
      merged.exclude_weekends,
      merged.exclude_holidays,
      merged.min_notice_days,
      merged.max_consecutive_days,
      companyId,
    ]
  );
  return result.rows[0];
}

async function listHolidays(companyId, year) {
  if (year) {
    const result = await pool.query(
      `SELECT * FROM holidays
       WHERE company_id = $1 AND EXTRACT(YEAR FROM holiday_date) = $2
       ORDER BY holiday_date`,
      [companyId, year]
    );
    return result.rows;
  }
  const result = await pool.query(
    'SELECT * FROM holidays WHERE company_id = $1 ORDER BY holiday_date',
    [companyId]
  );
  return result.rows;
}

async function addHoliday(companyId, { date, name }) {
  try {
    const result = await pool.query(
      'INSERT INTO holidays (company_id, holiday_date, name) VALUES ($1, $2, $3) RETURNING *',
      [companyId, date, name]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      const conflict = new Error('That date is already a holiday');
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  }
}

async function deleteHoliday(companyId, holidayId) {
  const result = await pool.query(
    'DELETE FROM holidays WHERE company_id = $1 AND id = $2 RETURNING *',
    [companyId, holidayId]
  );
  return result.rows[0];
}

async function getLeaveRules(companyId, year) {
  const policy = await getPolicy(companyId);
  const holidays = policy.exclude_holidays ? await listHolidays(companyId, year) : [];
  return {
    policy,
    excludeWeekends: policy.exclude_weekends,
    excludeHolidays: policy.exclude_holidays,
    holidays: holidays.map((h) => h.holiday_date),
  };
}

function pick(value, fallback) {
  return value === undefined || value === null ? fallback : value;
}

module.exports = {
  getPolicy,
  updatePolicy,
  listHolidays,
  addHoliday,
  deleteHoliday,
  getLeaveRules,
};
