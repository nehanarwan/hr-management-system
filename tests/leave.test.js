
const { app, pool, request, resetDatabase, buildCompany, auth, weekDates, giveEntitlement } = require('./helpers');

let company;
let year;

beforeAll(async () => {
  await resetDatabase();
  company = await buildCompany('acme', 'Acme Ltd');
  year = weekDates(0).year;
  await giveEntitlement(company.sessions.admin.token, company.people.employee.id, year, 20);
  await giveEntitlement(company.sessions.admin.token, company.people.other.id, year, 20);
  await giveEntitlement(company.sessions.admin.token, company.people.manager.id, year, 20);
});

afterAll(() => pool.end());

function createRequest(token, offsetWeeks, reason) {
  const dates = weekDates(offsetWeeks);
  return request(app)
    .post('/api/leave/requests')
    .set(auth(token))
    .send({ startDate: dates.startDate, endDate: dates.endDate, reason: reason || 'Holiday' });
}

function balance(token) {
  return request(app).get(`/api/leave/my-balance?year=${year}`).set(auth(token));
}

test('a full working week costs five days, not seven', async () => {
  const response = await createRequest(company.sessions.employee.token, 0);
  expect(response.status).toBe(201);
  expect(response.body.data.total_days).toBe(5);
});

test('a Friday to Monday request costs two days', async () => {
  const dates = weekDates(10);
  const friday = new Date(dates.startDate);
  friday.setUTCDate(friday.getUTCDate() + 4);
  const monday = new Date(friday);
  monday.setUTCDate(monday.getUTCDate() + 3);

  const response = await request(app)
    .get(`/api/leave/requests/preview?startDate=${friday.toISOString().slice(0, 10)}&endDate=${monday.toISOString().slice(0, 10)}`)
    .set(auth(company.sessions.employee.token));

  expect(response.body.data.totalDays).toBe(2);
});

test('a pending request does not reduce the balance', async () => {
  const response = await balance(company.sessions.employee.token);
  expect(response.body.data.entitlement).toBe(20);
  expect(response.body.data.used).toBe(0);
  expect(response.body.data.pending).toBe(5);
  expect(response.body.data.remaining).toBe(20);
});

test('a pending request is still reserved against new requests', async () => {
  const response = await balance(company.sessions.employee.token);
  expect(response.body.data.requestable).toBe(15);
});

test('overlapping dates are refused', async () => {
  const response = await createRequest(company.sessions.employee.token, 0, 'Again');
  expect(response.status).toBe(400);
  expect(response.body.message).toMatch(/already have a pending request/i);
});

test('an employee cannot request more days than they can still request', async () => {
  const dates = weekDates(2);
  const end = new Date(dates.startDate);
  end.setUTCDate(end.getUTCDate() + 30);

  const response = await request(app)
    .post('/api/leave/requests')
    .set(auth(company.sessions.employee.token))
    .send({ startDate: dates.startDate, endDate: end.toISOString().slice(0, 10), reason: 'Far too long' });

  expect(response.status).toBe(400);
});

test('an employee cannot approve their own request', async () => {
  const mine = await createRequest(company.sessions.manager.token, 4, 'My own leave');
  const response = await request(app)
    .patch(`/api/manager/leave-requests/${mine.body.data.id}/approve`)
    .set(auth(company.sessions.manager.token))
    .send({});
  expect(response.status).toBe(403);
  expect(response.body.message).toMatch(/your own/i);
});

test('approving reduces the balance and records who decided', async () => {
  const pending = await request(app)
    .get('/api/leave/requests?status=Pending')
    .set(auth(company.sessions.employee.token));
  const id = pending.body.data[0].id;

  const response = await request(app)
    .patch(`/api/manager/leave-requests/${id}/approve`)
    .set(auth(company.sessions.manager.token))
    .send({ comment: 'Enjoy' });

  expect(response.status).toBe(200);
  expect(response.body.data.status).toBe('Approved');
  expect(response.body.data.reviewer_id).toBe(company.people.manager.id);

  const after = await balance(company.sessions.employee.token);
  expect(after.body.data.used).toBe(5);
  expect(after.body.data.remaining).toBe(15);
  expect(after.body.data.pending).toBe(0);
});

test('approving writes a row to the approval history', async () => {
  const response = await request(app)
    .get('/api/manager/approval-history')
    .set(auth(company.sessions.manager.token));

  expect(response.body.data.length).toBeGreaterThan(0);
  expect(response.body.data[0].status).toBe('Approved');
  expect(response.body.data[0].head_comment).toBe('Enjoy');
});

test('a request cannot be approved twice', async () => {
  const approved = await request(app)
    .get('/api/leave/requests?status=Approved')
    .set(auth(company.sessions.employee.token));

  const response = await request(app)
    .patch(`/api/manager/leave-requests/${approved.body.data[0].id}/approve`)
    .set(auth(company.sessions.manager.token))
    .send({});

  expect(response.status).toBe(400);
  expect(response.body.message).toMatch(/already been approved/i);
});

test('rejecting does not touch the balance and needs a reason', async () => {
  const created = await createRequest(company.sessions.other.token, 6);
  const id = created.body.data.id;

  const noReason = await request(app)
    .patch(`/api/manager/leave-requests/${id}/reject`)
    .set(auth(company.sessions.manager.token))
    .send({});
  expect(noReason.status).toBe(400);

  const rejected = await request(app)
    .patch(`/api/manager/leave-requests/${id}/reject`)
    .set(auth(company.sessions.manager.token))
    .send({ reason: 'That week is already covered' });
  expect(rejected.status).toBe(200);

  const after = await request(app)
    .get(`/api/leave/my-balance?year=${year}`)
    .set(auth(company.sessions.other.token));
  expect(after.body.data.used).toBe(0);
  expect(after.body.data.remaining).toBe(20);
  expect(after.body.data.pending).toBe(0);
});

test('a manager cannot approve outside their own department', async () => {
  const outsider = await request(app)
    .post('/api/employees')
    .set(auth(company.sessions.admin.token))
    .send({
      firstName: 'Sam',
      lastName: 'Sales',
      email: 'sam@acme.com',
      password: 'password123',
      annualDays: 20,
    });

  await giveEntitlement(company.sessions.admin.token, outsider.body.data.id, year, 20);

  const samSession = await request(app)
    .post('/api/auth/login')
    .send({ companySlug: 'acme', email: 'sam@acme.com', password: 'password123' });

  const created = await createRequest(samSession.body.data.token, 8);

  const response = await request(app)
    .patch(`/api/manager/leave-requests/${created.body.data.id}/approve`)
    .set(auth(company.sessions.manager.token))
    .send({});

  expect(response.status).toBe(404);
});

test('cancelling keeps the record instead of deleting it', async () => {
  const created = await createRequest(company.sessions.employee.token, 12);
  const id = created.body.data.id;

  const cancelled = await request(app)
    .patch(`/api/leave/requests/${id}/cancel`)
    .set(auth(company.sessions.employee.token));

  expect(cancelled.status).toBe(200);
  expect(cancelled.body.data.status).toBe('Cancelled');

  const stillThere = await pool.query('SELECT status FROM leave_request WHERE id = $1', [id]);
  expect(stillThere.rows[0].status).toBe('Cancelled');
});

test('an employee cannot cancel a colleague\'s request', async () => {
  const created = await createRequest(company.sessions.other.token, 14);
  const response = await request(app)
    .patch(`/api/leave/requests/${created.body.data.id}/cancel`)
    .set(auth(company.sessions.employee.token));
  expect(response.status).toBe(403);
});

test('a request without an entitlement is refused', async () => {
  const created = await request(app)
    .post('/api/employees')
    .set(auth(company.sessions.admin.token))
    .send({
      firstName: 'Noa',
      lastName: 'New',
      email: 'noa@acme.com',
      password: 'password123',
      annualDays: 20,
    });

  const session = await request(app)
    .post('/api/auth/login')
    .send({ companySlug: 'acme', email: 'noa@acme.com', password: 'password123' });

  const dates = weekDates(16);
  const response = await request(app)
    .post('/api/leave/requests')
    .set(auth(session.body.data.token))
    .send({ startDate: dates.startDate, endDate: dates.endDate, reason: 'Next year' });

  expect(response.status).toBe(400);
  expect(response.body.message).toMatch(/entitlement/i);
  expect(created.body.data.id).toBeDefined();
});
