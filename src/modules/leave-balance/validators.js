const { body, param, query } = require('express-validator');

const yearQueryRule = query('year')
  .optional()
  .isInt({ min: 2000, max: 2100 })
  .withMessage('Year must be between 2000 and 2100');

const myBalanceRules = [yearQueryRule];

const listBalanceRules = [yearQueryRule];

const employeeBalanceRules = [
  param('employeeId').isInt({ min: 1 }).withMessage('Employee id must be a positive integer'),
  yearQueryRule,
];

const createBalanceRules = [
  body('employeeId').isInt({ min: 1 }).withMessage('Employee id must be a positive integer'),
  body('year').isInt({ min: 2000, max: 2100 }).withMessage('Year must be between 2000 and 2100'),
  body('totalDays').isInt({ min: 1, max: 365 }).withMessage('Total days must be between 1 and 365'),
];

const updateBalanceRules = [
  param('employeeId').isInt({ min: 1 }).withMessage('Employee id must be a positive integer'),
  param('year').isInt({ min: 2000, max: 2100 }).withMessage('Year must be between 2000 and 2100'),
  body('totalDays').isInt({ min: 1, max: 365 }).withMessage('Total days must be between 1 and 365'),
];

const deleteBalanceRules = [
  param('employeeId').isInt({ min: 1 }).withMessage('Employee id must be a positive integer'),
  param('year').isInt({ min: 2000, max: 2100 }).withMessage('Year must be between 2000 and 2100'),
];

module.exports = {
  myBalanceRules,
  listBalanceRules,
  employeeBalanceRules,
  createBalanceRules,
  updateBalanceRules,
  deleteBalanceRules,
};
