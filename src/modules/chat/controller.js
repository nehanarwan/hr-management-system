const service = require('./service');
const env = require('../../config/env');

async function ask(req, res, next) {
  try {
    if (!req.user.employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Your account is not linked to an employee record, so I cannot look up your leave.',
      });
    }

    const result = await service.ask(req.user, req.body.message, req.body.sessionId);
    res.json({
      success: true,
      data: { ...result, mode: env.anthropicApiKey ? 'claude' : 'rules' },
    });
  } catch (err) {
    next(err);
  }
}

async function history(req, res, next) {
  try {
    const messages = await service.getHistory(req.user, req.query.sessionId);
    if (messages === null) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
}

module.exports = { ask, history };
