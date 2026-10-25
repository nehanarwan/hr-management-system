const express = require('express');
const controller = require('./controller');
const { registerRules, loginRules } = require('./validators');
const handleValidationErrors = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/auth');

const router = express.Router();

router.post('/register', registerRules, handleValidationErrors, controller.register);
router.post('/login', loginRules, handleValidationErrors, controller.login);
router.get('/me', authenticate, controller.me);

module.exports = router;
