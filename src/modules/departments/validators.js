const { body, param, query } = require('express-validator');

const listDepartmentRules = [
  query('search').optional().isString().trim().isLength({ max: 100 }),
];

const departmentIdRules = [
  param('id').isInt({ min: 1 }).withMessage('Department id must be a positive integer'),
];

const createDepartmentRules = [
  body('name').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Department name is required'),
];

const updateDepartmentRules = [
  param('id').isInt({ min: 1 }).withMessage('Department id must be a positive integer'),
  body('name').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Department name is required'),
];

const assignManagerRules = [
  param('id').isInt({ min: 1 }).withMessage('Department id must be a positive integer'),
  body('employeeId').isInt({ min: 1 }).withMessage('Employee id must be a positive integer'),
];

module.exports = {
  listDepartmentRules,
  departmentIdRules,
  createDepartmentRules,
  updateDepartmentRules,
  assignManagerRules,
};
