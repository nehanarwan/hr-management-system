const express = require('express');
const controller = require('./controller');
const validate = require('../../middlewares/validate');
const {
  createRequestRules,
  updateRequestRules,
  requestIdRules,
  listRequestRules,
  previewRules,
} = require('./validators');

const router = express.Router();

router.get('/requests', listRequestRules, validate, controller.listMyRequests);
router.get('/requests/preview', previewRules, validate, controller.preview);
router.get('/upcoming', controller.upcoming);
router.get('/requests/:id', requestIdRules, validate, controller.getRequest);

router.post('/requests', createRequestRules, validate, controller.createRequest);
router.patch('/requests/:id', updateRequestRules, validate, controller.updateRequest);
router.patch('/requests/:id/cancel', requestIdRules, validate, controller.cancelRequest);

module.exports = router;
