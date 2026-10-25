
function toDate(value) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toISO(date) {
  return toDate(date).toISOString().slice(0, 10);
}

function isWeekend(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function eachDay(startDate, endDate) {
  const days = [];
  const current = toDate(startDate);
  const last = toDate(endDate);
  while (current <= last) {
    days.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}

function countLeaveDays(startDate, endDate, options = {}) {
  const excludeWeekends = options.excludeWeekends !== false;
  const excludeHolidays = options.excludeHolidays !== false;
  const holidays = new Set((options.holidays || []).map((h) => toISO(h)));

  let total = 0;
  eachDay(startDate, endDate).forEach((day) => {
    if (excludeWeekends && isWeekend(day)) return;
    if (excludeHolidays && holidays.has(toISO(day))) return;
    total += 1;
  });
  return total;
}

function rangesOverlap(startA, endA, startB, endB) {
  return toDate(startA) <= toDate(endB) && toDate(startB) <= toDate(endA);
}

function yearOf(date) {
  return toDate(date).getUTCFullYear();
}

module.exports = { toDate, toISO, isWeekend, eachDay, countLeaveDays, rangesOverlap, yearOf };
