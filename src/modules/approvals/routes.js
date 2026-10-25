const express = require('express');
const controller = require('./controller');
const validate = require('../../middlewares/validate');
const { authorize } = require('../../middlewares/auth');
const { listTeamRules, approveRules, rejectRules, requestIdRules } = require('./validators');

const router = express.Router();

router.use(authorize('manager', 'admin'));

router.get('/summary', controller.summary);
router.get('/leave-requests', listTeamRules, validate, controller.listTeamRequests);
router.get('/approval-history', controller.history);
router.get('/leave-requests/:id/history', requestIdRules, validate, controller.requestHistory);

router.patch('/leave-requests/:id/approve', approveRules, validate, controller.approve);
router.patch('/leave-requests/:id/reject', rejectRules, validate, controller.reject);

module.exports = router;
