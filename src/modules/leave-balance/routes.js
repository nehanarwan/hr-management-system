const express = require('express');
const controller = require('./controller');
const validate = require('../../middlewares/validate');
const { authorize } = require('../../middlewares/auth');
const {
  myBalanceRules,
  listBalanceRules,
  employeeBalanceRules,
  createBalanceRules,
  updateBalanceRules,
  deleteBalanceRules,
} = require('./validators');

const router = express.Router();

router.get('/my-balance', myBalanceRules, validate, controller.myBalance);

router.get('/balance', authorize('manager', 'admin'), listBalanceRules, validate, controller.listBalances);

router.get(
  '/balance/:employeeId',
  authorize('manager', 'admin'),
  employeeBalanceRules,
  validate,
  controller.getEmployeeBalance
);

router.post('/balance', authorize('admin'), createBalanceRules, validate, controller.createBalance);

router.patch(
  '/balance/:employeeId/:year',
  authorize('admin'),
  updateBalanceRules,
  validate,
  controller.updateBalance
);

router.delete(
  '/balance/:employeeId/:year',
  authorize('admin'),
  deleteBalanceRules,
  validate,
  controller.deleteBalance
);

module.exports = router;
