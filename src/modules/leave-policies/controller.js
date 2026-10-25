const service = require('./service');

async function getPolicy(req, res, next) {
  try {
    const policy = await service.getPolicy(req.user.companyId);
    res.json({ success: true, data: policy });
  } catch (err) {
    next(err);
  }
}

async function updatePolicy(req, res, next) {
  try {
    const policy = await service.updatePolicy(req.user.companyId, req.body);
    res.json({ success: true, data: policy });
  } catch (err) {
    next(err);
  }
}

async function listHolidays(req, res, next) {
  try {
    const holidays = await service.listHolidays(req.user.companyId, req.query.year);
    res.json({ success: true, data: holidays });
  } catch (err) {
    next(err);
  }
}

async function addHoliday(req, res, next) {
  try {
    const holiday = await service.addHoliday(req.user.companyId, req.body);
    res.status(201).json({ success: true, data: holiday });
  } catch (err) {
    next(err);
  }
}

async function deleteHoliday(req, res, next) {
  try {
    const removed = await service.deleteHoliday(req.user.companyId, req.params.id);
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Holiday not found' });
    }
    res.json({ success: true, message: 'Holiday removed' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPolicy, updatePolicy, listHolidays, addHoliday, deleteHoliday };
