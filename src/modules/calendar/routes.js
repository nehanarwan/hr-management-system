const express = require('express');
const controller = require('./controller');
const validate = require('../../middlewares/validate');
const { authorize } = require('../../middlewares/auth');
const { calendarRules } = require('./validators');

const router = express.Router();

router.get('/', calendarRules, validate, controller.getCalendar);
router.get('/who-is-out', controller.whoIsOut);
router.get('/company-stats', authorize('admin'), controller.companyStats);

module.exports = router;
