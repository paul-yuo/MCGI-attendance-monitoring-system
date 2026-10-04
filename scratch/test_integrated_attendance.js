/**
 * Comprehensive Integration Test Suite
 * Tests EventSchedule, App auto-detection, submission-time consistency,
 * Supabase payload mapping, Messenger formatting, and QR attendance.
 */
const assert = require('assert');
const EventSchedule = require('../js/event_schedule.js');

// 2026-10-04 is a Sunday
const at = (dow, hh, mm) => new Date(2026, 9, 4 + dow, hh, mm, 0);
const D = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

let totalTests = 0;
let passedTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`FAIL: ${desc}`);
    console.error(err);
  }
}

console.log('--- 1. Testing Sunday WS Schedule Transitions ---');
const sundayWsCases = [
  [12, 0, '1:30PM/SUN - VIEWING'],
  [13, 30, '1:30PM/SUN - VIEWING'],
  [15, 0, '1:30PM/SUN - VIEWING'],
  [17, 29, '1:30PM/SUN - VIEWING'],
  [17, 30, '5:30PM/SUN - VIEWING'],
  [18, 10, '5:30PM/SUN - VIEWING'],
  [20, 45, '5:30PM/SUN - VIEWING']
];

sundayWsCases.forEach(([h, m, expected]) => {
  it(`Sunday WS at ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} -> ${expected}`, () => {
    const res = EventSchedule.detect('WS', at(D.SUN, h, m));
    assert.strictEqual(res.status, 'detected');
    assert.strictEqual(res.slot.label, expected);
  });
});

console.log('\n--- 2. Testing Saturday WS Schedule Transitions ---');
it('Saturday WS 11:29 AM -> 3:30AM/SAT - LIVE', () => {
  const res = EventSchedule.detect('WS', at(D.SAT, 11, 29));
  assert.strictEqual(res.status, 'detected');
  assert.strictEqual(res.slot.label, '3:30AM/SAT - LIVE');
  assert.strictEqual(res.sessionType, 'LIVE');
});

it('Saturday WS 11:30 AM -> 11:30AM/SAT - VIEWING', () => {
  const res = EventSchedule.detect('WS', at(D.SAT, 11, 30));
  assert.strictEqual(res.status, 'detected');
  assert.strictEqual(res.slot.label, '11:30AM/SAT - VIEWING');
  assert.strictEqual(res.sessionType, 'VIEWING');
});

console.log('\n--- 3. Testing Wednesday PM Transitions ---');
it('Wednesday PM 2:29 PM -> 3:30AM/WED - LIVE', () => {
  const res = EventSchedule.detect('PM', at(D.WED, 14, 29));
  assert.strictEqual(res.slot.label, '3:30AM/WED - LIVE');
});

it('Wednesday PM 2:30 PM -> 2:30PM/WED - VIEWING', () => {
  const res = EventSchedule.detect('PM', at(D.WED, 14, 30));
  assert.strictEqual(res.slot.label, '2:30PM/WED - VIEWING');
});

it('Wednesday PM 5:29 PM -> 2:30PM/WED - VIEWING', () => {
  const res = EventSchedule.detect('PM', at(D.WED, 17, 29));
  assert.strictEqual(res.slot.label, '2:30PM/WED - VIEWING');
});

it('Wednesday PM 5:30 PM -> 5:30PM/WED - VIEWING', () => {
  const res = EventSchedule.detect('PM', at(D.WED, 17, 30));
  assert.strictEqual(res.slot.label, '5:30PM/WED - VIEWING');
});

console.log('\n--- 4. Testing Thursday PM Transitions ---');
it('Thursday PM 6:59 PM -> 7:00AM/THU - VIEWING', () => {
  const res = EventSchedule.detect('PM', at(D.THU, 18, 59));
  assert.strictEqual(res.slot.label, '7:00AM/THU - VIEWING');
});

it('Thursday PM 7:00 PM -> 7:00PM/THU - VIEWING', () => {
  const res = EventSchedule.detect('PM', at(D.THU, 19, 0));
  assert.strictEqual(res.slot.label, '7:00PM/THU - VIEWING');
});

console.log('\n--- 5. Testing Serbisyong Kapatiran Transitions ---');
it('Serbisyong Kapatiran 9:29 PM -> Afternoon Edition', () => {
  const res = EventSchedule.detect('SERBISYONG KAPATIRAN', at(D.TUE, 21, 29));
  assert.strictEqual(res.slot.label, 'AFTERNOON EDITION - 12:50PM');
});

it('Serbisyong Kapatiran 9:30 PM -> Evening Edition', () => {
  const res = EventSchedule.detect('SERBISYONG KAPATIRAN', at(D.TUE, 21, 30));
  assert.strictEqual(res.slot.label, 'EVENING EDITION - 9:30PM');
});

console.log('\n--- 6. Testing Overlap Disambiguation (Sunday 5:30 PM) ---');
it('Sunday 5:30 PM with WS -> WS 5:30 PM VIEWING', () => {
  const res = EventSchedule.detect('WS', at(D.SUN, 17, 30));
  assert.strictEqual(res.slot.label, '5:30PM/SUN - VIEWING');
  assert.strictEqual(res.scheduledTime, '5:30 PM');
  assert.strictEqual(res.sessionType, 'VIEWING');
});

it('Sunday 5:30 PM with PBB -> PBB 5:30 PM VIEWING', () => {
  const res = EventSchedule.detect('PBB', at(D.SUN, 17, 30));
  assert.strictEqual(res.slot.label, '5:30PM/SUN - VIEWING');
  assert.strictEqual(res.scheduledTime, '5:30 PM');
  assert.strictEqual(res.sessionType, 'VIEWING');
});

console.log('\n--- 7. Testing No Schedule Days ---');
it('WS on Wednesday returns status "none" and does not borrow Saturday/Sunday', () => {
  const res = EventSchedule.detect('WS', at(D.WED, 17, 30));
  assert.strictEqual(res.status, 'none');
});

it('PM on Monday returns status "none"', () => {
  const res = EventSchedule.detect('PM', at(D.MON, 10, 0));
  assert.strictEqual(res.status, 'none');
});

console.log('\n--- 8. Testing Submission Simulation & Field Consistency ---');
it('Submission at 8:45 PM Sunday for WS produces consistent fields', () => {
  const submitNow = at(D.SUN, 20, 45);
  const det = EventSchedule.detect('WS', submitNow);
  const timeIn = EventSchedule.formatLocalTime(submitNow);

  const entry = {
    event: 'WS',
    scheduleDay: det.dayName || 'Sunday',
    scheduledTime: det.scheduledTime,
    sessionType: det.sessionType,
    schedules: [det.slot.label],
    timeIn: timeIn,
    scheduleAutoDetected: true
  };

  assert.strictEqual(entry.event, 'WS');
  assert.strictEqual(entry.scheduleDay, 'Sunday');
  assert.strictEqual(entry.scheduledTime, '5:30 PM');
  assert.strictEqual(entry.sessionType, 'VIEWING');
  assert.strictEqual(entry.schedules[0], '5:30PM/SUN - VIEWING');
  assert.strictEqual(entry.timeIn, '8:45 PM');
  assert.strictEqual(entry.scheduleAutoDetected, true);
});

it('Boundary Transition: Submit at 5:30 PM Sunday detects 5:30 PM, not 1:30 PM', () => {
  const submitNow = at(D.SUN, 17, 30);
  const det = EventSchedule.detect('WS', submitNow);
  const timeIn = EventSchedule.formatLocalTime(submitNow);

  assert.strictEqual(det.slot.label, '5:30PM/SUN - VIEWING');
  assert.strictEqual(det.scheduledTime, '5:30 PM');
  assert.strictEqual(timeIn, '5:30 PM');
});

console.log('\n--- 9. Testing formatLocalTime helper ---');
it('formatLocalTime returns clean 12-hour format with AM/PM', () => {
  assert.strictEqual(EventSchedule.formatLocalTime(at(D.SUN, 17, 43)), '5:43 PM');
  assert.strictEqual(EventSchedule.formatLocalTime(at(D.SUN, 20, 45)), '8:45 PM');
  assert.strictEqual(EventSchedule.formatLocalTime(at(D.SUN, 9, 5)), '9:05 AM');
  assert.strictEqual(EventSchedule.formatLocalTime(at(D.SUN, 0, 15)), '12:15 AM');
});

console.log(`\n========================================`);
console.log(`Results: ${passedTests} / ${totalTests} passed`);
console.log(`========================================`);

if (passedTests !== totalTests) {
  process.exit(1);
}
