
const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');

async function resetDatabase() {
  await pool.query(
    'TRUNCATE chat_messages, chat_sessions, request_response, leave_request, leave_balance, holidays, leave_policies, employees, departments, users, companies RESTART IDENTITY CASCADE'
  );
}

async function registerCompany(slug, name) {
  const response = await request(app).post('/api/auth/register').send({
    companySlug: slug,
    companyName: name,
    firstName: 'Ada',
    lastName: 'Admin',
    email: `admin@${slug}.com`,
    password: 'password123',
  });
  return response.body.data;
}

async function login(slug, email) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ companySlug: slug, email, password: 'password123' });
  return response.body.data;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function buildCompany(slug, name) {
  await registerCompany(slug, name);
  const admin = await login(slug, `admin@${slug}.com`);

  const department = await request(app)
    .post('/api/departments')
    .set(auth(admin.token))
    .send({ name: 'Engineering' });
  const departmentId = department.body.data.id;

  const people = {};
  for (const person of [
    { key: 'manager', firstName: 'Mia', lastName: 'Manager' },
    { key: 'employee', firstName: 'Eli', lastName: 'Employee' },
    { key: 'other', firstName: 'Ola', lastName: 'Other' },
  ]) {
    const created = await request(app)
      .post('/api/employees')
      .set(auth(admin.token))
      .send({
        firstName: person.firstName,
        lastName: person.lastName,
        email: `${person.key}@${slug}.com`,
        password: 'password123',
        departmentId,
        annualDays: 20,
      });
    people[person.key] = created.body.data;
  }

  await request(app)
    .patch(`/api/departments/${departmentId}/manager`)
    .set(auth(admin.token))
    .send({ employeeId: people.manager.id });

  const sessions = {
    admin,
    manager: await login(slug, `manager@${slug}.com`),
    employee: await login(slug, `employee@${slug}.com`),
    other: await login(slug, `other@${slug}.com`),
  };

  return { slug, departmentId, people, sessions };
}


function weekDates(offsetWeeks) {
  const year = new Date().getFullYear() + 1;
  const start = new Date(Date.UTC(year, 5, 1)); // 1 June next year
  while (start.getUTCDay() !== 1) start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCDate(start.getUTCDate() + offsetWeeks * 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 4);
  return { startDate: iso(start), endDate: iso(end), year };
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

async function giveEntitlement(adminToken, employeeId, year, totalDays) {
  await request(app)
    .post('/api/leave/balance')
    .set(auth(adminToken))
    .send({ employeeId, year, totalDays });
}

module.exports = { app, pool, request, resetDatabase, buildCompany, login, auth, weekDates, giveEntitlement };
