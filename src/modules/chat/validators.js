const { body, query } = require('express-validator');

const askRules = [
  body('message').isString().trim().isLength({ min: 1, max: 1000 })
    .withMessage('Type a question (up to 1000 characters)'),
  body('sessionId').optional({ nullable: true }).isInt({ min: 1 })
    .withMessage('Session id must be a positive integer'),
];

const historyRules = [
  query('sessionId').optional().isInt({ min: 1 }).withMessage('Session id must be a positive integer'),
];

module.exports = { askRules, historyRules };
