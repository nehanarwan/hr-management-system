const service = require('./service');

function defaultRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

async function getCalendar(req, res, next) {
  try {
    const fallback = defaultRange();
    const entries = await service.getCalendar(req.user, {
      from: req.query.from || fallback.from,
      to: req.query.to || fallback.to,
      departmentId: req.query.departmentId,
      scope: req.query.scope,
    });
    res.json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
}

async function whoIsOut(req, res, next) {
  try {
    const rows = await service.getWhoIsOutToday(req.user.companyId);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function companyStats(req, res, next) {
  try {
    const stats = await service.getCompanyStats(req.user.companyId);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCalendar, whoIsOut, companyStats };
