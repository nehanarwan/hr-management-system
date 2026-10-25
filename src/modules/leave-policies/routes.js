const express = require('express');
const controller = require('./controller');
const validate = require('../../middlewares/validate');
const { authorize } = require('../../middlewares/auth');
const {
  updatePolicyRules,
  listHolidayRules,
  addHolidayRules,
  deleteHolidayRules,
} = require('./validators');

const router = express.Router();

router.get('/', controller.getPolicy);
router.get('/holidays', listHolidayRules, validate, controller.listHolidays);

router.patch('/', authorize('admin'), updatePolicyRules, validate, controller.updatePolicy);
router.post('/holidays', authorize('admin'), addHolidayRules, validate, controller.addHoliday);
router.delete('/holidays/:id', authorize('admin'), deleteHolidayRules, validate, controller.deleteHoliday);

module.exports = router;
