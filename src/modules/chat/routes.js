const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('./controller');
const validate = require('../../middlewares/validate');
const { askRules, historyRules } = require('./validators');

const router = express.Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages. Please wait a moment.' },
});

router.post('/', chatLimiter, askRules, validate, controller.ask);
router.get('/history', historyRules, validate, controller.history);

module.exports = router;
