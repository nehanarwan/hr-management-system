const { body, param, query } = require('express-validator');

const listTeamRules = [
  query('status')
    .optional()
    .isIn(['Pending', 'Approved', 'Rejected', 'Cancelled'])
    .withMessage('Status must be Pending, Approved, Rejected or Cancelled'),
];

const approveRules = [
  param('id').isInt({ min: 1 }).withMessage('Request id must be a positive integer'),
  body('comment').optional({ nullable: true }).isString().trim().isLength({ max: 500 })
    .withMessage('Comment cannot be longer than 500 characters'),
];


const rejectRules = [
  param('id').isInt({ min: 1 }).withMessage('Request id must be a positive integer'),
  body('reason')
    .isString()
    .bail()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('A reason is required when rejecting a request'),
];

const requestIdRules = [
  param('id').isInt({ min: 1 }).withMessage('Request id must be a positive integer'),
];

module.exports = { listTeamRules, approveRules, rejectRules, requestIdRules };
