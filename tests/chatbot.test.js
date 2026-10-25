// The assistant must only ever reach data the signed-in user is allowed to see.

const { app, pool, request, resetDatabase, buildCompany, auth, weekDates, giveEntitlement } = require('./helpers');
const { getToolsForUser } = require('../src/modules/chat/tools');

let alpha;
let beta;
let year;

beforeAll(async () => {
  await resetDatabase();
  alpha = await buildCompany('alpha', 'Alpha Ltd');
  beta = await buildCompany('beta', 'Beta Ltd');
  year = weekDates(0).year;
  await giveEntitlement(alpha.sessions.admin.token, alpha.people.employee.id, year, 20);
});

afterAll(() => pool.end());

function userFor(session, role) {
  return {
    id: session.user.id,
    companyId: session.user.companyId,
    employeeId: session.user.employeeId,
    departmentId: session.user.departmentId,
    role: role || session.user.role,
  };
}

test('an employee is given only the employee tools', () => {
  const tools = getToolsForUser(userFor(alpha.sessions.employee));
  expect(Object.keys(tools).sort()).toEqual([
    'get_leave_policy',
    'get_my_leave_balance',
    'get_my_leave_requests',
    'get_my_upcoming_leave',
  ]);
  expect(tools.get_employee_leave_balance).toBeUndefined();
});

test('a manager also gets the team tools', () => {
  const tools = getToolsForUser(userFor(alpha.sessions.manager));
  expect(tools.get_team_pending_requests).toBeDefined();
  expect(tools.get_employee_leave_balance).toBeDefined();
});

test('the balance tool always answers about the signed-in employee', async () => {
  const tools = getToolsForUser(userFor(alpha.sessions.employee));
  const result = await tools.get_my_leave_balance.run(userFor(alpha.sessions.employee), {});
  expect(result.entitlementDays).toBe(20);
  expect(result.usedDays).toBe(0);
});

test("a manager cannot read an employee outside their department", async () => {
  const tools = getToolsForUser(userFor(alpha.sessions.manager));
  const outsider = await request(app)
    .post('/api/employees')
    .set(auth(alpha.sessions.admin.token))
    .send({ firstName: 'Out', lastName: 'Side', email: 'out@alpha.com', password: 'password123' });

  const result = await tools.get_employee_leave_balance.run(userFor(alpha.sessions.manager), {
    employeeId: outsider.body.data.id,
  });
  expect(result.error).toMatch(/not allowed/i);
});

test("a manager cannot read an employee from another company", async () => {
  const tools = getToolsForUser(userFor(alpha.sessions.manager));
  const result = await tools.get_employee_leave_balance.run(userFor(alpha.sessions.manager), {
    employeeId: beta.people.employee.id,
  });
  expect(result.error).toBeDefined();
});

test('the chat endpoint needs a token', async () => {
  const response = await request(app).post('/api/chat').send({ message: 'Hello' });
  expect(response.status).toBe(401);
});

test('the chat endpoint answers with the signed-in employee\'s real numbers', async () => {
  const response = await request(app)
    .post('/api/chat')
    .set(auth(alpha.sessions.employee.token))
    .send({ message: 'How many leave days do I have left?' });

  expect(response.status).toBe(200);
  expect(response.body.data.answer).toMatch(/20/);
});

test('chat history is scoped to the user who owns it', async () => {
  const mine = await request(app).get('/api/chat/history').set(auth(alpha.sessions.employee.token));
  expect(mine.status).toBe(200);
  expect(mine.body.data.length).toBeGreaterThan(0);

  const theirs = await request(app).get('/api/chat/history').set(auth(alpha.sessions.other.token));
  expect(theirs.body.data.length).toBe(0);
});
