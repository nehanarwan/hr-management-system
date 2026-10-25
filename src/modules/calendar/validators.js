const { query } = require('express-validator');

const calendarRules = [
  query('from').optional().isISO8601().withMessage('from must be YYYY-MM-DD'),
  query('to').optional().isISO8601().withMessage('to must be YYYY-MM-DD'),
  query('departmentId').optional().isInt({ min: 1 }).withMessage('Department id must be a positive integer'),
  query('scope').optional().isIn(['company', 'team']).withMessage('scope must be company or team'),
];

module.exports = { calendarRules };
