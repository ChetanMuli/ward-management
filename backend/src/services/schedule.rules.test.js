const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getKolkataDateString,
  getKolkataOffsetDateString,
  getMonthRangeStrings,
  getWeekRangeStrings,
  getLastWeekRangeStrings,
  CATEGORIES,
  PRIORITIES,
  STATUSES,
} = require('../v2/controllers/schedule.controller');

describe('Nagarsevak Schedule Rules and Date Helpers', () => {
  it('TEST 1: getKolkataDateString formats YYYY-MM-DD in IST timezone', () => {
    // 2026-09-22 01:00 UTC = 2026-09-22 06:30 IST
    const d = new Date('2026-09-22T01:00:00Z');
    const result = getKolkataDateString(d);
    assert.equal(result, '2026-09-22');
  });

  it('TEST 2: getKolkataOffsetDateString correctly calculates yesterday (-1) and tomorrow (+1)', () => {
    const today = getKolkataDateString();
    const yesterday = getKolkataOffsetDateString(-1);
    const tomorrow = getKolkataOffsetDateString(1);

    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(today));
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(yesterday));
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(tomorrow));
    assert.notEqual(today, yesterday);
    assert.notEqual(today, tomorrow);
    assert.notEqual(yesterday, tomorrow);
  });

  it('TEST 3: getMonthRangeStrings returns valid first and last day of month', () => {
    const d = new Date('2026-09-15T12:00:00Z');
    const { firstDay, lastDay } = getMonthRangeStrings(d);
    assert.equal(firstDay, '2026-09-01');
    assert.equal(lastDay, '2026-09-30');
  });

  it('TEST 4: getMonthRangeStrings handles February leap year properly', () => {
    const leapFeb = new Date('2024-02-10T12:00:00Z');
    const { firstDay: f1, lastDay: l1 } = getMonthRangeStrings(leapFeb);
    assert.equal(f1, '2024-02-01');
    assert.equal(l1, '2024-02-29');

    const nonLeapFeb = new Date('2025-02-10T12:00:00Z');
    const { firstDay: f2, lastDay: l2 } = getMonthRangeStrings(nonLeapFeb);
    assert.equal(f2, '2025-02-01');
    assert.equal(l2, '2025-02-28');
  });

  it('TEST 5: getWeekRangeStrings computes Monday through Sunday range', () => {
    // 2026-09-22 is Tuesday
    const d = new Date('2026-09-22T10:00:00Z');
    const { startOfWeek, endOfWeek } = getWeekRangeStrings(d);
    assert.equal(startOfWeek, '2026-09-21'); // Monday
    assert.equal(endOfWeek, '2026-09-27');   // Sunday
  });

  it('TEST 5b: getLastWeekRangeStrings computes previous Monday through Sunday range', () => {
    // 2026-09-22 is Tuesday -> previous week was Mon Sep 14 to Sun Sep 20
    const d = new Date('2026-09-22T10:00:00Z');
    const { startOfLastWeek, endOfLastWeek } = getLastWeekRangeStrings(d);
    assert.equal(startOfLastWeek, '2026-09-14'); // Last Monday
    assert.equal(endOfLastWeek, '2026-09-20');   // Last Sunday
  });

  it('TEST 6: Valid categories, priorities, and statuses include user-specified requirements', () => {
    assert.ok(CATEGORIES.includes('VISIT'));
    assert.ok(CATEGORIES.includes('MEETING'));
    assert.ok(CATEGORIES.includes('INSPECTION'));
    assert.ok(CATEGORIES.includes('EVENT'));
    assert.ok(CATEGORIES.includes('CITIZEN_HEARING'));
    assert.ok(CATEGORIES.includes('OTHER'));

    assert.ok(PRIORITIES.includes('URGENT'));
    assert.ok(PRIORITIES.includes('HIGH'));
    assert.ok(PRIORITIES.includes('MEDIUM'));
    assert.ok(PRIORITIES.includes('LOW'));

    assert.ok(STATUSES.includes('PENDING'));
    assert.ok(STATUSES.includes('IN_PROGRESS'));
    assert.ok(STATUSES.includes('COMPLETED'));
    assert.ok(STATUSES.includes('CANCELLED'));
  });
});
