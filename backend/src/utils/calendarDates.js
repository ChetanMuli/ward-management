function parseUtcDate(value) {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  const d = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function stamp(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const d = parseUtcDate(dateString);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return stamp(d);
}

function addYears(dateString, years) {
  const d = parseUtcDate(dateString);
  if (!d) return null;
  const targetYear = d.getUTCFullYear() + Number(years || 0);
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  d.setUTCFullYear(targetYear, month, day);
  if (month === 1 && day === 29 && d.getUTCMonth() !== 1) d.setUTCFullYear(targetYear, 1, 28);
  return stamp(d);
}

function todayStamp(timeZone = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

function displayDate(value) {
  const d = parseUtcDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function monthDayFromDob(dob) {
  const d = parseUtcDate(dob);
  if (!d) return null;
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

module.exports = {
  parseUtcDate,
  addDays,
  addYears,
  todayStamp,
  displayDate,
  isLeapYear,
  monthDayFromDob,
};
