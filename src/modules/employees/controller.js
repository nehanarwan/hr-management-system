const service = require('./service');
const balanceService = require('../leave-balance/service');
const { buildPagination } = require('../../utils/pagination');

async function listEmployees(req, res, next) {
  try {
    const { page, limit, offset } = buildPagination(req.query);
    const result = await service.listEmployees(req.user, {
      search: req.query.search,
      departmentId: req.query.departmentId,
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

async function getEmployee(req, res, next) {
  try {
    const allowed = await service.canViewEmployee(req.user, req.params.id);
    if (!allowed) {
     
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    const employee = await service.getEmployee(req.user.companyId, req.params.id);
    res.json({ success: true, data: employee });
  } catch (err) {
    next(err);
  }
}

async function getEmployeeBalance(req, res, next) {
  try {
    const allowed = await service.canViewEmployee(req.user, req.params.id);
    if (!allowed) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    const year = req.query.year || new Date().getFullYear();
    const summary = await balanceService.getSummary(req.user.companyId, req.params.id, year);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
}

async function createEmployee(req, res, next) {
  try {
    const employee = await service.createEmployee(req.user.companyId, req.body);
    res.status(201).json({ success: true, data: employee });
  } catch (err) {
    next(err);
  }
}

async function updateEmployee(req, res, next) {
  try {
    const updated = await service.updateEmployee(req.user.companyId, req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function changeRole(req, res, next) {
  try {
    const updated = await service.changeRole(req.user.companyId, req.params.id, req.body.role);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { listEmployees, getEmployee, getEmployeeBalance, createEmployee, updateEmployee, changeRole };
