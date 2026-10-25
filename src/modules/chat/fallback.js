
function match(question, words) {
  const q = question.toLowerCase();
  return words.some((word) => q.includes(word));
}

async function answer(user, question, tools) {
  const isManager = user.role === 'manager' || user.role === 'admin';

  if (isManager && match(question, ['pending', 'waiting', 'approve', 'to review'])) {
    const rows = await tools.get_team_pending_requests.run(user, {});
    if (rows.length === 0) return 'You have no leave requests waiting for a decision.';
    const lines = rows
      .slice(0, 5)
      .map((r) => `- ${r.employee}: ${r.from} to ${r.to} (${r.days} day(s))`)
      .join('\n');
    return `You have ${rows.length} request(s) waiting for a decision:\n${lines}`;
  }

  if (isManager && match(question, ['who is on leave', 'who is off', 'team leave', 'upcoming team', "who's off"])) {
    const rows = await tools.get_team_leave_calendar.run(user, {});
    if (rows.length === 0) return 'Nobody in your team has approved leave in the next 30 days.';
    const lines = rows.map((r) => `- ${r.employee}: ${r.from} to ${r.to}`).join('\n');
    return `Approved leave in your team over the next 30 days:\n${lines}`;
  }

  if (match(question, ['policy', 'rule', 'weekend', 'holiday', 'how do i request', 'how to request'])) {
    const policy = await tools.get_leave_policy.run(user, {});
    return (
      `The default annual entitlement is ${policy.defaultAnnualDays} days. ` +
      `Weekends ${policy.weekendsCountAsLeave ? 'do' : 'do not'} count against your leave, and ` +
      `public holidays ${policy.publicHolidaysCountAsLeave ? 'do' : 'do not'}. ` +
      `You can take at most ${policy.maximumConsecutiveDays} days in a row` +
      (policy.minimumNoticeDays > 0 ? `, with at least ${policy.minimumNoticeDays} days notice.` : '.') +
      ' To request leave, open the Request Leave page, pick your dates and add a reason.'
    );
  }

  if (match(question, ['upcoming', 'next leave', 'when is my'])) {
    const rows = await tools.get_my_upcoming_leave.run(user, {});
    if (rows.length === 0) return 'You have no approved leave coming up.';
    const next = rows[0];
    return `Your next approved leave is from ${next.from} to ${next.to} (${next.days} day(s)).`;
  }

  if (match(question, ['rejected', 'why was', 'declined'])) {
    const rows = await tools.get_my_leave_requests.run(user, { status: 'Rejected' });
    if (rows.length === 0) return 'None of your leave requests have been rejected.';
    const last = rows[0];
    return (
      `Your request from ${last.from} to ${last.to} was rejected` +
      (last.decidedBy ? ` by ${last.decidedBy}` : '') +
      (last.managerComment ? `. Reason given: "${last.managerComment}"` : '.')
    );
  }

  if (match(question, ['pending', 'waiting', 'status of my', 'my request'])) {
    const rows = await tools.get_my_leave_requests.run(user, {});
    if (rows.length === 0) return 'You have not made any leave requests yet.';
    const lines = rows
      .slice(0, 5)
      .map((r) => `- ${r.from} to ${r.to} (${r.days} day(s)): ${r.status}`)
      .join('\n');
    return `Here are your most recent leave requests:\n${lines}`;
  }

  if (match(question, ['used', 'taken', 'how many days have i'])) {
    const balance = await tools.get_my_leave_balance.run(user, {});
    return `You have used ${balance.usedDays} of your ${balance.entitlementDays} days this year.`;
  }

  if (match(question, ['balance', 'left', 'remaining', 'entitlement', 'how many days', 'annual leave'])) {
    const balance = await tools.get_my_leave_balance.run(user, {});
    return (
      `You have ${balance.remainingDays} day(s) of annual leave remaining out of ${balance.entitlementDays}. ` +
      `${balance.usedDays} day(s) have been approved` +
      (balance.pendingDays > 0
        ? ` and ${balance.pendingDays} day(s) are still waiting for a decision, so you can request up to ${balance.daysYouCanStillRequest} more day(s).`
        : '.')
    );
  }

  const balance = await tools.get_my_leave_balance.run(user, {});
  return (
    `I can help with your leave balance, your requests, upcoming leave and the company policy. ` +
    `Right now you have ${balance.remainingDays} day(s) remaining out of ${balance.entitlementDays}.`
  );
}

module.exports = { answer };
