
const pool = require('../src/config/db');
const bcrypt = require('bcrypt');

const YEAR = new Date().getFullYear();
const PASSWORD = 'password123';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Clearing existing data...');
    await client.query('TRUNCATE chat_messages, chat_sessions, request_response, leave_request, leave_balance, holidays, leave_policies, employees, departments, users, companies RESTART IDENTITY CASCADE');

    const northwind = await createCompany(client, {
      name: 'Northwind Logistics',
      slug: 'northwind',
      departments: ['Engineering', 'Operations'],
      admin: { firstName: 'Aylin', lastName: 'Demir', email: 'admin@northwind.com' },
      staff: [
        { firstName: 'Mert', lastName: 'Kaya', email: 'mert@northwind.com', department: 'Engineering', manager: true },
        { firstName: 'Selin', lastName: 'Yilmaz', email: 'selin@northwind.com', department: 'Engineering' },
        { firstName: 'Can', lastName: 'Ozturk', email: 'can@northwind.com', department: 'Engineering' },
        { firstName: 'Deniz', lastName: 'Arslan', email: 'deniz@northwind.com', department: 'Operations', manager: true },
        { firstName: 'Ece', lastName: 'Sahin', email: 'ece@northwind.com', department: 'Operations' },
      ],
      holidays: [
        { date: `${YEAR}-01-01`, name: "New Year's Day" },
        { date: `${YEAR}-10-29`, name: 'Republic Day' },
      ],
    });

    const bluepeak = await createCompany(client, {
      name: 'Bluepeak Health',
      slug: 'bluepeak',
      departments: ['Nursing'],
      admin: { firstName: 'Priya', lastName: 'Nair', email: 'admin@bluepeak.com' },
      staff: [
        { firstName: 'Jonas', lastName: 'Weber', email: 'jonas@bluepeak.com', department: 'Nursing', manager: true },
        { firstName: 'Amara', lastName: 'Okafor', email: 'amara@bluepeak.com', department: 'Nursing' },
      ],
      holidays: [{ date: `${YEAR}-01-01`, name: "New Year's Day" }],
    });


    await createRequest(client, northwind, 'Selin', `${YEAR}-03-02`, `${YEAR}-03-06`, 5, 'Approved', 'Mert', 'Enjoy the break');
    await createRequest(client, northwind, 'Selin', `${YEAR}-11-16`, `${YEAR}-11-18`, 3, 'Pending', null, null);
    await createRequest(client, northwind, 'Can', `${YEAR}-04-13`, `${YEAR}-04-17`, 5, 'Rejected', 'Mert', 'Two people are already off that week');
    await createRequest(client, northwind, 'Can', `${YEAR}-12-21`, `${YEAR}-12-24`, 4, 'Pending', null, null);
    await createRequest(client, northwind, 'Ece', `${YEAR}-09-07`, `${YEAR}-09-11`, 5, 'Approved', 'Deniz', null);
    await createRequest(client, bluepeak, 'Amara', `${YEAR}-05-04`, `${YEAR}-05-08`, 5, 'Approved', 'Jonas', null);

    await client.query('COMMIT');

    console.log('\nSeed complete. Log in at http://localhost:3000\n');
    console.log('  Northwind Logistics (slug: northwind)');
    console.log('    admin    admin@northwind.com');
    console.log('    manager  mert@northwind.com     (Engineering)');
    console.log('    manager  deniz@northwind.com    (Operations)');
    console.log('    employee selin@northwind.com');
    console.log('    employee can@northwind.com');
    console.log('    employee ece@northwind.com');
    console.log('\n  Bluepeak Health (slug: bluepeak)');
    console.log('    admin    admin@bluepeak.com');
    console.log('    manager  jonas@bluepeak.com     (Nursing)');
    console.log('    employee amara@bluepeak.com');
    console.log(`\n  Password for every account: ${PASSWORD}\n`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

async function createCompany(client, spec) {
  const companyResult = await client.query(
    'INSERT INTO companies (name, slug) VALUES ($1, $2) RETURNING *',
    [spec.name, spec.slug]
  );
  const company = companyResult.rows[0];
  console.log(`Creating ${company.name}...`);

  await client.query('INSERT INTO leave_policies (company_id) VALUES ($1)', [company.id]);

  for (const holiday of spec.holidays) {
    await client.query(
      'INSERT INTO holidays (company_id, holiday_date, name) VALUES ($1, $2, $3)',
      [company.id, holiday.date, holiday.name]
    );
  }

  const departments = {};
  for (const name of spec.departments) {
    const result = await client.query(
      'INSERT INTO departments (company_id, name) VALUES ($1, $2) RETURNING *',
      [company.id, name]
    );
    departments[name] = result.rows[0];
  }

  const employees = {};
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const admin = await addPerson(client, company, passwordHash, {
    ...spec.admin,
    role: 'admin',
    departmentId: null,
  });
  employees[spec.admin.firstName] = admin;

  for (const person of spec.staff) {
    const employee = await addPerson(client, company, passwordHash, {
      ...person,
      role: person.manager ? 'manager' : 'employee',
      departmentId: departments[person.department].id,
    });
    employees[person.firstName] = employee;

    if (person.manager) {
      await client.query('UPDATE departments SET manager_id = $1 WHERE id = $2', [
        employee.id,
        departments[person.department].id,
      ]);
    }
  }

  return { company, departments, employees };
}

async function addPerson(client, company, passwordHash, person) {
  const userResult = await client.query(
    'INSERT INTO users (company_id, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
    [company.id, person.email, passwordHash, person.role]
  );

  const employeeResult = await client.query(
    `INSERT INTO employees (company_id, department_id, first_name, last_name, user_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [company.id, person.departmentId, person.firstName, person.lastName, userResult.rows[0].id]
  );
  const employee = employeeResult.rows[0];

  await client.query(
    `INSERT INTO leave_balance (company_id, employee_id, year, total_days, used_days, remaining_days, is_active)
     VALUES ($1, $2, $3, 20, 0, 20, true)`,
    [company.id, employee.id, YEAR]
  );

  return employee;
}

async function createRequest(client, tenant, employeeName, startDate, endDate, days, status, reviewerName, comment) {
  const employee = tenant.employees[employeeName];
  const reviewer = reviewerName ? tenant.employees[reviewerName] : null;

  const result = await client.query(
    `INSERT INTO leave_request
       (company_id, employee_id, start_date, end_date, total_days, status, user_comment,
        reviewer_id, reviewer_comment, reviewed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      tenant.company.id,
      employee.id,
      startDate,
      endDate,
      days,
      status,
      'Annual leave',
      reviewer ? reviewer.id : null,
      comment,
      reviewer ? new Date() : null,
    ]
  );
  const request = result.rows[0];

  if (reviewer) {
    await client.query(
      `INSERT INTO request_response (company_id, reviewer_id, leave_request_id, head_comment, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenant.company.id, reviewer.id, request.id, comment, status]
    );
  }

  // Approved leave is the only thing that moves the balance.
  if (status === 'Approved') {
    await client.query(
      `UPDATE leave_balance
       SET used_days = used_days + $1, remaining_days = total_days - (used_days + $1)
       WHERE company_id = $2 AND employee_id = $3 AND year = $4`,
      [days, tenant.company.id, employee.id, new Date(startDate).getFullYear()]
    );
  }
}

main();
