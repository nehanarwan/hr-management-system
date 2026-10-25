const service = require('./service');
const requestService = require('../leave-request/service');
const employeeService = require('../employees/service');
const { buildPagination } = require('../../utils/pagination');

async function listTeamRequests(req, res, next) {
  try {
    const { page, limit, offset } = buildPagination(req.query);
    const result = await requestService.listTeamRequests(req.user, {
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

async function approve(req, res, next) {
  try {
    const request = await requestService.getRequestById(req.user.companyId, req.params.id);
    const check = await service.canReview(req.user, request);

    if (!check.allowed) {
      if (check.reason === 'own_request') {
        return res.status(403).json({ success: false, message: 'You cannot decide on your own leave request' });
      }
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const result = await service.approveRequest(req.user, req.params.id, req.body.comment);
    if (!result.ok) return res.status(400).json({ success: false, message: explain(result) });

    res.json({ success: true, message: 'Leave request approved', data: result.request });
  } catch (err) {
    next(err);
  }
}

async function reject(req, res, next) {
  try {
    const request = await requestService.getRequestById(req.user.companyId, req.params.id);
    const check = await service.canReview(req.user, request);

    if (!check.allowed) {
      if (check.reason === 'own_request') {
        return res.status(403).json({ success: false, message: 'You cannot decide on your own leave request' });
      }
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const result = await service.rejectRequest(req.user, req.params.id, req.body.reason);
    if (!result.ok) return res.status(400).json({ success: false, message: explain(result) });

    res.json({ success: true, message: 'Leave request rejected', data: result.request });
  } catch (err) {
    next(err);
  }
}

async function history(req, res, next) {
  try {
    const { page, limit, offset } = buildPagination(req.query);
    const result = await service.listApprovalHistory(req.user, {
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

async function requestHistory(req, res, next) {
  try {
    const rows = await service.getRequestHistory(req.user, req.params.id);
    if (rows === null) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function summary(req, res, next) {
  try {
    const pending = await requestService.listTeamRequests(req.user, {
      status: 'Pending',
      page: 1,
      limit: 1,
      offset: 0,
    });
    const approved = await requestService.listTeamRequests(req.user, {
      status: 'Approved',
      page: 1,
      limit: 1,
      offset: 0,
    });
    const employees = await employeeService.listEmployees(req.user, { page: 1, limit: 1, offset: 0 });

    res.json({
      success: true,
      data: {
        employeeCount: employees.meta.total,
        pendingCount: pending.meta.total,
        approvedCount: approved.meta.total,
      },
    });
  } catch (err) {
    next(err);
  }
}

function explain(result) {
  if (result.reason === 'not_found') return 'Leave request not found';
  if (result.reason === 'not_pending') return `This request has already been ${result.status.toLowerCase()}`;
  if (result.reason === 'no_balance') return `This employee has no leave entitlement for ${result.year}`;
  if (result.reason === 'insufficient') {
    return `Not enough leave balance. The employee has ${result.remaining} day(s) left but requested ${result.requested}.`;
  }
  return 'The request could not be processed';
}

module.exports = { listTeamRequests, approve, reject, history, requestHistory, summary };
