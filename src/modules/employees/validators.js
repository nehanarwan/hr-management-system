const { body, param, query } = require('express-validator');

const listEmployeeRules = [
  query('search').optional().isString().trim().isLength({ max: 100 }),
  query('departmentId').optional().isInt({ min: 1 }).withMessage('Department id must be a positive integer'),
];

const employeeIdRules = [
  param('id').isInt({ min: 1 }).withMessage('Employee id must be a positive integer'),
];

const createEmployeeRules = [
  body('firstName').isString().trim().isLength({ min: 1, max: 100 }).withMessage('First name is required'),
  body('lastName').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Last name is required'),
  body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('departmentId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Department id must be a positive integer'),
  body('role').optional().isIn(['employee', 'manager', 'admin']).withMessage('Role must be employee, manager or admin'),
  body('annualDays').optional().isInt({ min: 1, max: 365 }).withMessage('Annual days must be between 1 and 365'),
];

const updateEmployeeRules = [
  param('id').isInt({ min: 1 }).withMessage('Employee id must be a positive integer'),
  body('firstName').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('lastName').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('departmentId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Department id must be a positive integer'),
];

const changeRoleRules = [
  param('id').isInt({ min: 1 }).withMessage('Employee id must be a positive integer'),
  body('role').isIn(['employee', 'manager', 'admin']).withMessage('Role must be employee, manager or admin'),
];

module.exports = {
  listEmployeeRules,
  employeeIdRules,
  createEmployeeRules,
  updateEmployeeRules,
  changeRoleRules,
};
