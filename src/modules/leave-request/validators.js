const { body, param, query } = require('express-validator');

const dateRangeRules = [
  body('startDate').isISO8601().withMessage('Start date must be YYYY-MM-DD'),
  body('endDate')
    .isISO8601()
    .withMessage('End date must be YYYY-MM-DD')
    .bail()
    .custom((endDate, { req }) => {
      if (new Date(endDate) < new Date(req.body.startDate)) {
        throw new Error('End date cannot be before the start date');
      }
      return true;
    }),
  body('reason')
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('A reason is required and cannot be longer than 500 characters'),
];

const createRequestRules = dateRangeRules;

const updateRequestRules = [
  param('id').isInt({ min: 1 }).withMessage('Request id must be a positive integer'),
  ...dateRangeRules,
];

const requestIdRules = [
  param('id').isInt({ min: 1 }).withMessage('Request id must be a positive integer'),
];

const listRequestRules = [
  query('status')
    .optional()
    .isIn(['Pending', 'Approved', 'Rejected', 'Cancelled'])
    .withMessage('Status must be Pending, Approved, Rejected or Cancelled'),
];

const previewRules = [
  query('startDate').isISO8601().withMessage('Start date must be YYYY-MM-DD'),
  query('endDate').isISO8601().withMessage('End date must be YYYY-MM-DD'),
];

module.exports = { createRequestRules, updateRequestRules, requestIdRules, listRequestRules, previewRules };
