const service = require('./service');
const { buildPagination } = require('../../utils/pagination');


async function createRequest(req, res, next) {
  try {
    if (!req.user.employeeId) {
      return res.status(400).json({ success: false, message: 'Your account is not linked to an employee record' });
    }
    const request = await service.createRequest(req.user.companyId, req.user.employeeId, req.body);
    res.status(201).json({ success: true, message: 'Leave request submitted', data: request });
  } catch (err) {
    next(err);
  }
}

async function listMyRequests(req, res, next) {
  try {
    const { page, limit, offset } = buildPagination(req.query);
    const result = await service.listMyRequests(req.user.companyId, req.user.employeeId, {
      status: req.query.status,
      sort: req.query.sort,
      page,
      limit,
      offset,
    });
    res.json({ success: true, data: result.data, meta: result.meta });
  } catch (err) {
    next(err);
  }
}

async function getRequest(req, res, next) {
  try {
    const request = await service.getRequestById(req.user.companyId, req.params.id);
    const allowed = await service.canViewRequest(req.user, request);
    if (!allowed) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    res.json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
}

async function updateRequest(req, res, next) {
  try {
    const updated = await service.updateRequest(
      req.user.companyId,
      req.user.employeeId,
      req.params.id,
      req.body
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    res.json({ success: true, message: 'Leave request updated', data: updated });
  } catch (err) {
    next(err);
  }
}

async function cancelRequest(req, res, next) {
  try {
    const cancelled = await service.cancelRequest(req.user.companyId, req.user.employeeId, req.params.id);
    if (!cancelled) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    res.json({ success: true, message: 'Leave request cancelled', data: cancelled });
  } catch (err) {
    next(err);
  }
}

async function upcoming(req, res, next) {
  try {
    const rows = await service.getUpcomingLeave(req.user.companyId, req.user.employeeId);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}


async function preview(req, res, next) {
  try {
    const days = await service.calculateDays(req.user.companyId, req.query.startDate, req.query.endDate);
    res.json({ success: true, data: { totalDays: days } });
  } catch (err) {
    next(err);
  }
}

module.exports = { createRequest, listMyRequests, getRequest, updateRequest, cancelRequest, upcoming, preview };
