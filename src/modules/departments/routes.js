const express = require('express');
const controller = require('./controller');
const validate = require('../../middlewares/validate');
const { authorize } = require('../../middlewares/auth');
const {
  listDepartmentRules,
  departmentIdRules,
  createDepartmentRules,
  updateDepartmentRules,
  assignManagerRules,
} = require('./validators');

const router = express.Router();

router.get('/', listDepartmentRules, validate, controller.listDepartments);
router.get('/managers', authorize('admin'), controller.listManagers);
router.get('/:id', departmentIdRules, validate, controller.getDepartment);

router.post('/', authorize('admin'), createDepartmentRules, validate, controller.createDepartment);
router.patch('/:id', authorize('admin'), updateDepartmentRules, validate, controller.updateDepartment);
router.delete('/:id', authorize('admin'), departmentIdRules, validate, controller.deleteDepartment);

router.patch('/:id/manager', authorize('admin'), assignManagerRules, validate, controller.assignManager);
router.delete('/:id/manager', authorize('admin'), departmentIdRules, validate, controller.removeManager);

module.exports = router;
