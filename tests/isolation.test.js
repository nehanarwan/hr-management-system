// The rule that matters most: one company can never see another company's data,
// and one employee can never see another employee's.

const { app, pool, request, resetDatabase, buildCompany, auth, weekDates, giveEntitlement } = require('./helpers');

let alpha;
let beta;
let alphaRequestId;

beforeAll(async () => {
  await resetDatabase();
  alpha = await buildCompany('alpha', 'Alpha Ltd');
  beta = await buildCompany('beta', 'Beta Ltd');

  const dates = weekDates(0);
  await giveEntitlement(alpha.sessions.admin.token, alpha.people.employee.id, dates.year, 20);

  const created = await request(app)
    .post('/api/leave/requests')
    .set(auth(alpha.sessions.employee.token))
    .send({ ...dates, reason: 'Holiday' });
  alphaRequestId = created.body.data.id;
});

afterAll(() => pool.end());

test('an endpoint cannot be reached without a token', async () => {
  const response = await request(app).get('/api/leave/my-balance');
  expect(response.status).toBe(401);
});

test('a company only sees its own employees', async () => {
  const response = await request(app).get('/api/employees').set(auth(beta.sessions.admin.token));
  const names = response.body.data.map((e) => e.email);
  expect(names.every((email) => email.endsWith('@beta.com'))).toBe(true);
  expect(response.body.meta.total).toBe(4);
});

test("an admin cannot read another company's employee by id", async () => {
  const response = await request(app)
    .get(`/api/employees/${alpha.people.employee.id}`)
    .set(auth(beta.sessions.admin.token));
  expect(response.status).toBe(404);
});

test("a manager cannot read another company's leave request", async () => {
  const response = await request(app)
    .get(`/api/leave/requests/${alphaRequestId}`)
    .set(auth(beta.sessions.manager.token));
  expect(response.status).toBe(404);
});

test("a manager cannot approve another company's leave request", async () => {
  const response = await request(app)
    .patch(`/api/manager/leave-requests/${alphaRequestId}/approve`)
    .set(auth(beta.sessions.manager.token))
    .send({});
  expect(response.status).toBe(404);

  const check = await pool.query('SELECT status FROM leave_request WHERE id = $1', [alphaRequestId]);
  expect(check.rows[0].status).toBe('Pending');
});

test('an employee cannot read a colleague\'s leave balance', async () => {
  const response = await request(app)
    .get(`/api/employees/${alpha.people.other.id}/leave-balance`)
    .set(auth(alpha.sessions.employee.token));
  expect(response.status).toBe(404);
});

test('an employee cannot reach the manager endpoints at all', async () => {
  const response = await request(app)
    .get('/api/manager/leave-requests')
    .set(auth(alpha.sessions.employee.token));
  expect(response.status).toBe(403);
});

test('an employee cannot create a department', async () => {
  const response = await request(app)
    .post('/api/departments')
    .set(auth(alpha.sessions.employee.token))
    .send({ name: 'Sneaky' });
  expect(response.status).toBe(403);
});

test('the same email can exist in two different companies', async () => {
  const login = await request(app)
    .post('/api/auth/login')
    .send({ companySlug: 'beta', email: 'employee@beta.com', password: 'password123' });
  expect(login.status).toBe(200);
  expect(login.body.data.user.companySlug).toBe('beta');
});
