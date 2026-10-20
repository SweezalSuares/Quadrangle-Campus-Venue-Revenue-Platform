/**
 * Plain-Node assertion tests for the pure pricing/scheduling logic.
 * No framework, no DB — run with: npm test
 */
const assert = require('assert');
const pricing = require('../src/services/pricing.service');
const Venue = require('../src/models/Venue');

const rules = {
  weekend: 0.30, weekday: 0.05, morning: 0.08, afternoon: 0.04, evening: 0.28,
  demandStep: 0.04, demandCap: 0.30, popularBoost: 0.12,
  popularCategories: ['Auditorium', 'Amphitheatre', 'Sports Ground'],
};

let passed = 0;
function check(label, fn) {
  try { fn(); passed += 1; console.log(`  ok - ${label}`); }
  catch (e) { console.error(`  FAIL - ${label}\n    ${e.message}`); process.exitCode = 1; }
}

console.log('dayType / slotType');
check('a Saturday is a weekend', () => assert.strictEqual(pricing.dayType('2026-09-19'), 'weekend'));
check('a Tuesday is a weekday', () => assert.strictEqual(pricing.dayType('2026-09-15'), 'weekday'));
check('09:00 is morning', () => assert.strictEqual(pricing.slotType('09:00'), 'morning'));
check('14:00 is afternoon', () => assert.strictEqual(pricing.slotType('14:00'), 'afternoon'));
check('19:00 is evening', () => assert.strictEqual(pricing.slotType('19:00'), 'evening'));

console.log('computePrice');
const auditorium = { basePrice: 10000, category: 'Auditorium' };
const classroom = { basePrice: 2000, category: 'Classroom' };
check('popular category costs more than a non-popular one at the same base multiplier', () => {
  const a = pricing.computePrice(auditorium, '2026-09-15', '19:00', [], rules);
  const b = pricing.computePrice({ ...auditorium, category: 'Classroom' }, '2026-09-15', '19:00', [], rules);
  assert.ok(a > b);
});
check('evening slot costs more than morning slot, same day', () => {
  const evening = pricing.computePrice(classroom, '2026-09-15', '19:00', [], rules);
  const morning = pricing.computePrice(classroom, '2026-09-15', '09:00', [], rules);
  assert.ok(evening > morning);
});
check('weekend costs more than weekday, same slot', () => {
  const weekend = pricing.computePrice(classroom, '2026-09-19', '19:00', [], rules);
  const weekday = pricing.computePrice(classroom, '2026-09-15', '19:00', [], rules);
  assert.ok(weekend > weekday);
});
check('recent demand raises price, capped correctly', () => {
  const noDemand = pricing.computePrice(classroom, '2026-09-15', '19:00', [], rules);
  const busyBookings = Array.from({ length: 10 }, (_, i) => ({ date: '2026-09-16', status: 'approved' }));
  const highDemand = pricing.computePrice(classroom, '2026-09-15', '19:00', busyBookings, rules);
  const expectedCapMultiplier = 1 + rules.weekday + rules.evening + rules.demandCap;
  assert.ok(highDemand > noDemand);
  assert.strictEqual(highDemand, Math.round((classroom.basePrice * expectedCapMultiplier) / 50) * 50);
});

console.log('demandLabel');
check('0-1 recent bookings is low demand', () => {
  assert.strictEqual(pricing.demandLabel([{ date: '2026-09-15', status: 'approved' }], '2026-09-15'), 'low');
});
check('2-3 recent bookings is medium demand', () => {
  const bks = [{ date: '2026-09-15', status: 'approved' }, { date: '2026-09-16', status: 'approved' }];
  assert.strictEqual(pricing.demandLabel(bks, '2026-09-15'), 'medium');
});
check('4+ recent bookings is high demand', () => {
  const bks = Array.from({ length: 4 }, () => ({ date: '2026-09-15', status: 'approved' }));
  assert.strictEqual(pricing.demandLabel(bks, '2026-09-15'), 'high');
});
check('rejected/cancelled bookings do not count toward demand', () => {
  const bks = [
    { date: '2026-09-15', status: 'rejected' },
    { date: '2026-09-15', status: 'cancelled' },
    { date: '2026-09-15', status: 'rejected' },
    { date: '2026-09-15', status: 'cancelled' },
  ];
  assert.strictEqual(pricing.demandLabel(bks, '2026-09-15'), 'low');
});

console.log('findConflict');
const venueBookings = [
  { _id: 'b1', date: '2026-09-20', start: '18:00', end: '20:00', status: 'approved' },
  { _id: 'b2', date: '2026-09-20', start: '09:00', end: '10:00', status: 'rejected' },
];
check('overlapping time on the same date is a conflict', () => {
  const c = pricing.findConflict(venueBookings, '2026-09-20', '19:00', '21:00');
  assert.strictEqual(c._id, 'b1');
});
check('back-to-back (touching) slots are not a conflict', () => {
  const c = pricing.findConflict(venueBookings, '2026-09-20', '20:00', '21:00');
  assert.strictEqual(c, undefined);
});
check('a rejected booking does not block the slot', () => {
  const c = pricing.findConflict(venueBookings, '2026-09-20', '09:00', '10:00');
  assert.strictEqual(c, undefined);
});
check('excludeId lets a booking ignore its own prior slot (for edits)', () => {
  const c = pricing.findConflict(venueBookings, '2026-09-20', '18:30', '19:30', 'b1');
  assert.strictEqual(c, undefined);
});
check('different date is never a conflict', () => {
  const c = pricing.findConflict(venueBookings, '2026-09-21', '18:00', '20:00');
  assert.strictEqual(c, undefined);
});

console.log('suggestSlots');
check('returns open gaps around an existing booking, within the 08:00-21:00 day window', () => {
  const bks = [{ date: '2026-09-20', start: '12:00', end: '14:00', status: 'approved' }];
  const slots = pricing.suggestSlots(bks, '2026-09-20', 2);
  assert.ok(slots.some((s) => s.start === '08:00' && s.end === '10:00'));
  assert.ok(slots.some((s) => s.start === '14:00'));
  slots.forEach((s) => {
    assert.ok(pricing.toMin(s.start) >= 8 * 60);
    assert.ok(pricing.toMin(s.end) <= 21 * 60);
  });
});
check('a fully booked day returns no slots', () => {
  const bks = [{ date: '2026-09-20', start: '08:00', end: '21:00', status: 'approved' }];
  const slots = pricing.suggestSlots(bks, '2026-09-20', 2);
  assert.strictEqual(slots.length, 0);
});

console.log('utilizationPercent');
check('caps at 100%', () => assert.strictEqual(pricing.utilizationPercent(999, 20), 100));
check('computes a straightforward percentage', () => assert.strictEqual(pricing.utilizationPercent(5, 20), 25));

check('venues accept an optional imageUrl field', () => {
  const imageField = Venue.schema.path('imageUrl');
  assert.ok(imageField, 'imageUrl should exist on the Venue schema');
  assert.strictEqual(imageField.instance, 'String');
});

console.log(`\n${passed} check(s) passed.`);
