const balanceService = require('../leave-balance/service');
const requestService = require('../leave-request/service');
const policyService = require('../leave-policies/service');
const employeeService = require('../employees/service');
const calendarService = require('../calendar/service');
const dates = require('../../utils/dates');

function currentYear() {
  return new Date().getFullYear();
}

const employeeTools = {
  get_my_leave_balance: {
    description:
      "The signed-in employee's leave entitlement for a year: total days, days already approved, days waiting for a decision, and days remaining.",
    input_schema: {
      type: 'object',
      properties: { year: { type: 'integer', description: 'Defaults to the current year.' } },
    },
    run: async (user, args) => {
      const summary = await balanceService.getSummary(user.companyId, user.employeeId, args.year || currentYear());
      return {
        year: summary.year,
        entitlementDays: summary.entitlement,
        usedDays: summary.used,
        pendingDays: summary.pending,
        remainingDays: summary.remaining,
        daysYouCanStillRequest: summary.requestable,
      };
    },
  },

  get_my_leave_requests: {
    description:
      "The signed-in employee's own leave requests, newest first. Use this to answer questions about the status of a request or why one was rejected.",
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'] },
      },
    },
    run: async (user, args) => {
      const result = await requestService.listMyRequests(user.companyId, user.employeeId, {
        status: args.status,
        page: 1,
        limit: 10,
        offset: 0,
      });
      return result.data.map(summariseRequest);
    },
  },

  get_my_upcoming_leave: {
    description: "The signed-in employee's approved leave that has not finished yet.",
    input_schema: { type: 'object', properties: {} },
    run: async (user) => {
      const rows = await requestService.getUpcomingLeave(user.companyId, user.employeeId);
      return rows.map(summariseRequest);
    },
  },

  get_leave_policy: {
    description:
      "The company's leave policy: default annual entitlement, whether weekends and public holidays count, notice period and the longest allowed stretch of leave.",
    input_schema: { type: 'object', properties: {} },
    run: async (user) => {
      const policy = await policyService.getPolicy(user.companyId);
      const holidays = await policyService.listHolidays(user.companyId, currentYear());
      return {
        defaultAnnualDays: policy.default_annual_days,
        weekendsCountAsLeave: !policy.exclude_weekends,
        publicHolidaysCountAsLeave: !policy.exclude_holidays,
        minimumNoticeDays: policy.min_notice_days,
        maximumConsecutiveDays: policy.max_consecutive_days,
        holidaysThisYear: holidays.map((h) => ({ date: dates.toISO(h.holiday_date), name: h.name })),
      };
    },
  },
};

const managerTools = {
  get_team_pending_requests: {
    description:
      'Leave requests waiting for a decision from the departments this manager runs. Admins get the whole company.',
    input_schema: { type: 'object', properties: {} },
    run: async (user) => {
      const result = await requestService.listTeamRequests(user, {
        status: 'Pending',
        page: 1,
        limit: 25,
        offset: 0,
      });
      return result.data.map(summariseRequest);
    },
  },

  get_team_leave_calendar: {
    description:
      'Approved leave in a date range, for the departments this manager runs. Use it to answer "who is off" questions.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
        to: { type: 'string', description: 'YYYY-MM-DD. Defaults to 30 days from today.' },
      },
    },
    run: async (user, args) => {
      const from = args.from || dates.toISO(new Date());
      const to = args.to || addDays(from, 30);
      const rows = await calendarService.getCalendar(user, { from, to, scope: 'team' });
      return rows.map((row) => ({
        employee: `${row.first_name} ${row.last_name}`,
        department: row.department_name,
        from: dates.toISO(row.start_date),
        to: dates.toISO(row.end_date),
        days: row.total_days,
      }));
    },
  },

  get_employee_leave_balance: {
    description:
      'The leave balance of one employee in this manager\'s departments. Returns nothing if the employee is not someone this manager is allowed to see.',
    input_schema: {
      type: 'object',
      properties: {
        employeeId: { type: 'integer', description: 'The employee id, from get_team_pending_requests or the team list.' },
        year: { type: 'integer' },
      },
      required: ['employeeId'],
    },
    run: async (user, args) => {
      // The permission check happens here, before any data is read.
      const allowed = await employeeService.canViewEmployee(user, args.employeeId);
      if (!allowed) {
        return { error: 'You are not allowed to see this employee, or they do not exist.' };
      }
      const employee = await employeeService.getEmployee(user.companyId, args.employeeId);
      const summary = await balanceService.getSummary(user.companyId, args.employeeId, args.year || currentYear());
      return {
        employee: `${employee.first_name} ${employee.last_name}`,
        year: summary.year,
        entitlementDays: summary.entitlement,
        usedDays: summary.used,
        pendingDays: summary.pending,
        remainingDays: summary.remaining,
      };
    },
  },
};

function getToolsForUser(user) {
  if (user.role === 'manager' || user.role === 'admin') {
    return { ...employeeTools, ...managerTools };
  }
  return { ...employeeTools };
}

function summariseRequest(row) {
  return {
    id: row.id,
    employee: row.first_name ? `${row.first_name} ${row.last_name}` : undefined,
    employeeId: row.employee_id,
    from: dates.toISO(row.start_date),
    to: dates.toISO(row.end_date),
    days: row.total_days,
    status: row.status,
    reason: row.user_comment,
    managerComment: row.reviewer_comment || null,
    decidedBy: row.reviewer_first_name ? `${row.reviewer_first_name} ${row.reviewer_last_name}` : null,
  };
}

function addDays(isoDate, days) {
  const date = dates.toDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return dates.toISO(date);
}

module.exports = { getToolsForUser, employeeTools, managerTools };
