/**
 * Pricing & scheduling intelligence for Quadrangle.
 * Every function here is pure (no DB access) so it can be unit tested and
 * reused for both the live "quote" endpoint and the final booking price.
 */

function toMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function fmtMin(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${(h % 24).toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

function dayType(dateStr) {
  const day = new Date(`${dateStr}T00:00:00`).getDay();
  return day === 0 || day === 6 ? 'weekend' : 'weekday';
}

function slotType(start) {
  const h = parseInt(start.split(':')[0], 10);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// bookings: array of { date, status } already scoped to a single venue.
function demandCountForVenueWeek(bookings, dateStr) {
  const target = new Date(`${dateStr}T00:00:00`);
  return bookings.filter((b) => {
    if (b.status === 'rejected' || b.status === 'cancelled') return false;
    const bd = new Date(`${b.date}T00:00:00`);
    const diffDays = Math.abs((bd - target) / (1000 * 3600 * 24));
    return diffDays <= 7;
  }).length;
}

function demandLabel(bookings, dateStr) {
  const c = demandCountForVenueWeek(bookings, dateStr);
  if (c >= 4) return 'high';
  if (c >= 2) return 'medium';
  return 'low';
}

/**
 * @param venue        Mongoose Venue doc (or plain object) with basePrice/category
 * @param dateStr      'YYYY-MM-DD'
 * @param start,end    'HH:MM'
 * @param venueBookings bookings already filtered to this venue (any date, active or not)
 * @param rules        PricingRule doc
 */
function computePrice(venue, dateStr, start, venueBookings, rules) {
  let mult = 1;
  mult += dayType(dateStr) === 'weekend' ? rules.weekend : rules.weekday;
  mult += rules[slotType(start)];
  const demand = demandCountForVenueWeek(venueBookings, dateStr);
  mult += Math.min(demand * rules.demandStep, rules.demandCap);
  if ((rules.popularCategories || []).includes(venue.category)) mult += rules.popularBoost;
  return Math.round((venue.basePrice * mult) / 50) * 50;
}

// venueBookings: active bookings for this exact venue (any date)
function findConflict(venueBookings, dateStr, start, end, excludeId) {
  const s1 = toMin(start);
  const e1 = toMin(end);
  return venueBookings.find((b) => {
    if (excludeId && String(b._id) === String(excludeId)) return false;
    if (b.date !== dateStr) return false;
    if (b.status === 'rejected' || b.status === 'cancelled') return false;
    const s2 = toMin(b.start);
    const e2 = toMin(b.end);
    return s1 < e2 && s2 < e1;
  });
}

function suggestSlots(venueBookings, dateStr, durationHours) {
  const busy = venueBookings
    .filter((b) => b.date === dateStr && b.status !== 'rejected' && b.status !== 'cancelled')
    .map((b) => ({ s: toMin(b.start), e: toMin(b.end) }))
    .sort((a, b) => a.s - b.s);

  const dayStart = 8 * 60;
  const dayEnd = 21 * 60;
  const slots = [];
  let cursor = dayStart;
  for (const b of busy) {
    if (b.s - cursor >= durationHours * 60) slots.push([cursor, b.s]);
    cursor = Math.max(cursor, b.e);
  }
  if (dayEnd - cursor >= durationHours * 60) slots.push([cursor, dayEnd]);

  return slots.slice(0, 3).map(([s]) => ({
    start: fmtMin(s),
    end: fmtMin(s + durationHours * 60),
  }));
}

function utilizationPercent(bookingCount, assumedMonthlySlots = 20) {
  return Math.min(100, Math.round((bookingCount / assumedMonthlySlots) * 100));
}

module.exports = {
  toMin,
  fmtMin,
  dayType,
  slotType,
  demandCountForVenueWeek,
  demandLabel,
  computePrice,
  findConflict,
  suggestSlots,
  utilizationPercent,
};
