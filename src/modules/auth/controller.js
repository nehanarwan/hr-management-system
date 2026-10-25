const service = require('./service');

async function register(req, res, next) {
  try {
    const { companyName, companySlug, email, password, firstName, lastName } = req.body;
    const result = await service.registerCompanyWithAdmin({
      companyName,
      companySlug,
      email,
      password,
      firstName,
      lastName,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { companySlug, email, password } = req.body;
    const result = await service.login({ companySlug, email, password });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await service.getMe(req.user.companyId, req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me };
