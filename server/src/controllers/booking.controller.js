const Booking = require('../models/Booking');
const Venue = require('../models/Venue');
const Notification = require('../models/Notification');
const User = require('../models/User');
const PricingRule = require('../models/PricingRule');
const pricing = require('../services/pricing.service');
const { buildPaymentQr } = require('../services/qrcode.service');

async function getRules() {
  let rules = await PricingRule.findOne({ key: 'default' });
  if (!rules) rules = await PricingRule.create({ key: 'default' });
  return rules;
}

async function notify(userId, text, type) {
  await Notification.create({ user: userId, text, type: type || 'info' });
}

// GET /api/bookings/quote?venueId=&date=&start=&end=
async function quote(req, res, next) {
  try {
    const { venueId, date, start, end } = req.query;
    if (!venueId || !date || !start || !end) {
      return res.status(400).json({ message: 'venueId, date, start and end are required.' });
    }
    const venue = await Venue.findById(venueId);
    if (!venue) return res.status(404).json({ message: 'Venue not found.' });

    const rules = await getRules();
    const venueBookings = await Booking.find({ venue: venueId });

    const price = pricing.computePrice(venue, date, start, venueBookings, rules);
    const demand = pricing.demandLabel(venueBookings, date);
    const conflict = pricing.findConflict(venueBookings, date, start, end);

    let suggestions = null;
    if (conflict) {
      const durationHours = (pricing.toMin(end) - pricing.toMin(start)) / 60;
      const slots = pricing.suggestSlots(venueBookings, date, durationHours > 0 ? durationHours : 1);
      const otherVenues = await Venue.find({ _id: { $ne: venueId } });
      const altVenues = otherVenues
        .filter((v) => v.capacity >= venue.capacity)
        .sort((a, b) => {
          const catA = a.category === venue.category ? 0 : 1;
          const catB = b.category === venue.category ? 0 : 1;
          if (catA !== catB) return catA - catB;
          return a.basePrice - b.basePrice;
        })
        .slice(0, 3);
      suggestions = {
        conflictWith: { start: conflict.start, end: conflict.end },
        openSlots: slots,
        alternateVenues: altVenues.map((v) => ({ id: v._id, name: v.name, capacity: v.capacity, category: v.category })),
      };
    }

    res.json({ price, demand, conflict: Boolean(conflict), suggestions });
  } catch (err) {
    next(err);
  }
}

// POST /api/bookings
async function createBooking(req, res, next) {
  try {
    const { venueId, date, start, end, purpose } = req.body;
    if (!venueId || !date || !start || !end) {
      return res.status(400).json({ message: 'venueId, date, start and end are required.' });
    }
    if (pricing.toMin(end) <= pricing.toMin(start)) {
      return res.status(400).json({ message: 'End time must be after start time.' });
    }
    const venue = await Venue.findById(venueId);
    if (!venue) return res.status(404).json({ message: 'Venue not found.' });

    const rules = await getRules();
    const venueBookings = await Booking.find({ venue: venueId });

    const conflict = pricing.findConflict(venueBookings, date, start, end);
    if (conflict) {
      return res.status(409).json({ message: 'That slot was just booked — please choose another time.' });
    }

    const price = pricing.computePrice(venue, date, start, venueBookings, rules);

    const booking = await Booking.create({
      venue: venueId,
      user: req.user._id,
      userRole: req.user.role,
      date, start, end,
      purpose: purpose || 'Not specified',
      status: 'pending',
      price,
      paymentStatus: 'unpaid',
    });

    await notify(req.user._id, `Your request for ${venue.name} on ${date} was submitted and is pending approval.`, 'info');
    const managers = await User.find({ role: { $in: ['manager', 'admin'] } });
    await Promise.all(managers.map((m) => notify(m._id, `New booking request: ${venue.name} from ${req.user.name} on ${date}.`, 'info')));

    const populated = await booking.populate('venue');
    res.status(201).json({ booking: populated });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings?status=
async function listBookings(req, res, next) {
  try {
    const filter = {};
    const isManager = ['manager', 'admin'].includes(req.user.role);
    if (!isManager) filter.user = req.user._id;
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;

    const bookings = await Booking.find(filter)
      .populate('venue')
      .populate('user', 'name email role')
      .sort({ date: -1, createdAt: -1 });
    res.json({ bookings });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:id/status   { status: approved|rejected|cancelled }
async function setStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'status must be approved, rejected or cancelled.' });
    }
    const booking = await Booking.findById(req.params.id).populate('venue');
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    const isManager = ['manager', 'admin'].includes(req.user.role);
    const isOwner = String(booking.user) === String(req.user._id);

    if ((status === 'approved' || status === 'rejected') && !isManager) {
      return res.status(403).json({ message: 'Only facility managers or admins can approve or reject bookings.' });
    }
    if (status === 'cancelled') {
      if (!isOwner && !isManager) return res.status(403).json({ message: 'You can only cancel your own bookings.' });
      if (booking.status !== 'pending' && !isManager) {
        return res.status(400).json({ message: 'Only pending bookings can be cancelled.' });
      }
    }

    booking.status = status;
    await booking.save();

    const messages = {
      approved: `Your booking for ${booking.venue.name} on ${booking.date} was approved. Payment is now due.`,
      rejected: `Your booking for ${booking.venue.name} on ${booking.date} was rejected — the slot didn't clear.`,
      cancelled: `Booking for ${booking.venue.name} on ${booking.date} was cancelled.`,
    };
    const types = { approved: 'good', rejected: 'bad', cancelled: 'info' };
    await notify(booking.user, messages[status], types[status]);

    res.json({ booking });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:id/pay
async function markPaid(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id).populate('venue');
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    const isManager = ['manager', 'admin'].includes(req.user.role);
    const isOwner = String(booking.user) === String(req.user._id);
    if (!isManager && !isOwner) return res.status(403).json({ message: 'Not authorized for this booking.' });
    if (booking.status !== 'approved') return res.status(400).json({ message: 'Only approved bookings can be paid.' });

    booking.paymentStatus = 'paid';
    await booking.save();
    await notify(booking.user, `Payment confirmed for ${booking.venue.name} on ${booking.date}. Receipt available.`, 'good');

    res.json({ booking });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/:id/payment-qr
async function paymentQr(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id).populate('venue');
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    const isManager = ['manager', 'admin'].includes(req.user.role);
    const isOwner = String(booking.user) === String(req.user._id);
    if (!isManager && !isOwner) return res.status(403).json({ message: 'Not authorized for this booking.' });

    const qr = await buildPaymentQr(booking, booking.venue.name);
    res.json(qr);
  } catch (err) {
    next(err);
  }
}

module.exports = { quote, createBooking, listBookings, setStatus, markPaid, paymentQr };
