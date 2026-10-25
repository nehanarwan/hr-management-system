const service = require('./service');
const { buildPagination } = require('../../utils/pagination');

async function listDepartments(req, res, next) {
  try {
    const { page, limit, offset } = buildPagination(req.query);
    const result = await service.listDepartments(req.user.companyId, {
      search: req.query.search,
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

async function getDepartment(req, res, next) {
  try {
    const department = await service.getDepartment(req.user.companyId, req.params.id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    res.json({ success: true, data: department });
  } catch (err) {
    next(err);
  }
}

async function createDepartment(req, res, next) {
  try {
    const department = await service.createDepartment(req.user.companyId, req.body);
    res.status(201).json({ success: true, data: department });
  } catch (err) {
    next(err);
  }
}

async function updateDepartment(req, res, next) {
  try {
    const department = await service.updateDepartment(req.user.companyId, req.params.id, req.body);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    // The old version forgot to send anything here, so the request hung.
    res.json({ success: true, data: department });
  } catch (err) {
    next(err);
  }
}

async function deleteDepartment(req, res, next) {
  try {
    const department = await service.deleteDepartment(req.user.companyId, req.params.id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    res.json({ success: true, message: 'Department deleted' });
  } catch (err) {
    next(err);
  }
}

async function assignManager(req, res, next) {
  try {
    const result = await service.assignManager(req.user.companyId, req.params.id, req.body.employeeId);
    if (!result.ok) {
      const message = result.reason === 'employee_not_found' ? 'Employee not found' : 'Department not found';
      return res.status(404).json({ success: false, message });
    }
    res.json({ success: true, message: 'Manager assigned', data: result.department });
  } catch (err) {
    next(err);
  }
}

async function removeManager(req, res, next) {
  try {
    const result = await service.removeManager(req.user.companyId, req.params.id);
    if (!result.ok) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    res.json({ success: true, message: 'Manager removed', data: result.department });
  } catch (err) {
    next(err);
  }
}

async function listManagers(req, res, next) {
  try {
    const managers = await service.listManagers(req.user.companyId);
    res.json({ success: true, data: managers });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  assignManager,
  removeManager,
  listManagers,
};
