const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const { authenticate } = require('./middlewares/auth');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  })
);

app.use(cors(env.corsOrigins.length > 0 ? { origin: env.corsOrigins } : {}));

app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/favicon.ico', (req, res) => {
  res.type('image/svg+xml').sendFile(path.join(__dirname, '..', 'public', 'favicon.svg'));
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isTest ? 10000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', require('./modules/auth/routes'));

app.use('/api', authenticate);

app.use('/api/departments', require('./modules/departments/routes'));
app.use('/api/employees', require('./modules/employees/routes'));
app.use('/api/leave', require('./modules/leave-balance/routes'));
app.use('/api/leave', require('./modules/leave-request/routes'));
app.use('/api/manager', require('./modules/approvals/routes'));
app.use('/api/calendar', require('./modules/calendar/routes'));
app.use('/api/leave-policies', require('./modules/leave-policies/routes'));
app.use('/api/chat', require('./modules/chat/routes'));

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
});

app.use(errorHandler);

module.exports = app;