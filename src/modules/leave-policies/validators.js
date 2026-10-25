const { body, param, query } = require('express-validator');

const updatePolicyRules = [
  body('defaultAnnualDays').optional().isInt({ min: 1, max: 365 }).withMessage('Default annual days must be 1-365'),
  body('excludeWeekends').optional().isBoolean().withMessage('excludeWeekends must be true or false'),
  body('excludeHolidays').optional().isBoolean().withMessage('excludeHolidays must be true or false'),
  body('minNoticeDays').optional().isInt({ min: 0, max: 90 }).withMessage('Minimum notice must be 0-90 days'),
  body('maxConsecutiveDays').optional().isInt({ min: 1, max: 365 }).withMessage('Maximum consecutive days must be 1-365'),
];

const listHolidayRules = [
  query('year').optional().isInt({ min: 2000, max: 2100 }).withMessage('Year must be between 2000 and 2100'),
];

const addHolidayRules = [
  body('date').isISO8601().withMessage('Date must be YYYY-MM-DD'),
  body('name').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Holiday name is required'),
];

const deleteHolidayRules = [
  param('id').isInt({ min: 1 }).withMessage('Holiday id must be a positive integer'),
];

module.exports = { updatePolicyRules, listHolidayRules, addHolidayRules, deleteHolidayRules };
