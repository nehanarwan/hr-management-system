const express = require('express');
const controller = require('./controller');
const validate = require('../../middlewares/validate');
const { authorize } = require('../../middlewares/auth');
const {
  listEmployeeRules,
  employeeIdRules,
  createEmployeeRules,
  updateEmployeeRules,
  changeRoleRules,
} = require('./validators');

const router = express.Router();

router.get('/', listEmployeeRules, validate, controller.listEmployees);
router.get('/:id', employeeIdRules, validate, controller.getEmployee);
router.get('/:id/leave-balance', employeeIdRules, validate, controller.getEmployeeBalance);

router.post('/', authorize('admin'), createEmployeeRules, validate, controller.createEmployee);
router.patch('/:id', authorize('admin'), updateEmployeeRules, validate, controller.updateEmployee);
router.patch('/:id/role', authorize('admin'), changeRoleRules, validate, controller.changeRole);

module.exports = router;
