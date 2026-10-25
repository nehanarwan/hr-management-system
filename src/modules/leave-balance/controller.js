const service = require('./service');
const employeeService = require('../employees/service');
const { buildPagination } = require('../../utils/pagination');

function currentYear() {
  return new Date().getFullYear();
}

async function myBalance(req, res, next) {
  try {
    const year = req.query.year || currentYear();
    const summary = await service.getSummary(req.user.companyId, req.user.employeeId, year);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
}

async function listBalances(req, res, next) {
  try {
    const { page, limit, offset } = buildPagination(req.query);
    const result = await service.listBalances(req.user.companyId, {
      year: req.query.year,
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

async function getEmployeeBalance(req, res, next) {
  try {
    const { employeeId } = req.params;
    const year = req.query.year || currentYear();

    const allowed = await employeeService.canViewEmployee(req.user, employeeId);
    if (!allowed) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const summary = await service.getSummary(req.user.companyId, employeeId, year);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
}

async function createBalance(req, res, next) {
  try {
    const { employeeId, year, totalDays } = req.body;

    const employee = await employeeService.getEmployee(req.user.companyId, employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const balance = await service.createBalance(req.user.companyId, employeeId, year, totalDays);
    res.status(201).json({ success: true, data: balance });
  } catch (err) {
    next(err);
  }
}

async function updateBalance(req, res, next) {
  try {
    const { employeeId, year } = req.params;
    const { totalDays } = req.body;

    const updated = await service.updateBalance(req.user.companyId, employeeId, year, totalDays);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Leave balance not found' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function deleteBalance(req, res, next) {
  try {
    const { employeeId, year } = req.params;
    const removed = await service.deactivateBalance(req.user.companyId, employeeId, year);
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Leave balance not found' });
    }
    res.json({ success: true, message: 'Leave balance deactivated', data: removed });
  } catch (err) {
    next(err);
  }
}

module.exports = { myBalance, listBalances, getEmployeeBalance, createBalance, updateBalance, deleteBalance };
