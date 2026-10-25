const { body } = require('express-validator');

function companySlugRule() {
  return body('companySlug')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Company slug is required')
    .bail()
    .isLength({ min: 3, max: 50 })
    .withMessage('Company slug must be 3-50 characters')
    .bail()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Company slug can only contain lowercase letters, numbers and dashes');
}

const registerRules = [
  companySlugRule(),
  body('companyName').isString().trim().notEmpty().withMessage('Company name is required'),
  body('firstName').isString().trim().notEmpty().withMessage('First name is required'),
  body('lastName').isString().trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const loginRules = [
  companySlugRule(),
  body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

module.exports = { registerRules, loginRules };
