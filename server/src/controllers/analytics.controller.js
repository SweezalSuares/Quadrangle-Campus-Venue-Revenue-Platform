const Booking = require('../models/Booking');
const Venue = require('../models/Venue');
const User = require('../models/User');
const pricing = require('../services/pricing.service');

async function summary(req, res, next) {
  try {
    const [totalRevenueAgg] = await Booking.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$price' } } },
    ]);
    const [pendingRevenueAgg] = await Booking.aggregate([
      { $match: { status: 'approved', paymentStatus: 'unpaid' } },
      { $group: { _id: null, total: { $sum: '$price' } } },
    ]);
    const totalUsers = await User.countDocuments();
    const totalVenues = await Venue.countDocuments();
    const totalBookings = await Booking.countDocuments();
    const pendingCount = await Booking.countDocuments({ status: 'pending' });

    res.json({
      totalRevenue: totalRevenueAgg ? totalRevenueAgg.total : 0,
      pendingRevenue: pendingRevenueAgg ? pendingRevenueAgg.total : 0,
      totalUsers, totalVenues, totalBookings, pendingCount,
    });
  } catch (err) {
    next(err);
  }
}

async function revenueByVenue(req, res, next) {
  try {
    const venues = await Venue.find();
    const bookings = await Booking.find({ paymentStatus: 'paid' });
    const data = venues.map((v) => ({
      venueId: v._id,
      name: v.name,
      revenue: bookings.filter((b) => String(b.venue) === String(v._id)).reduce((s, b) => s + b.price, 0),
    }));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function categorySplit(req, res, next) {
  try {
    const venues = await Venue.find();
    const venueMap = Object.fromEntries(venues.map((v) => [String(v._id), v.category]));
    const bookings = await Booking.find({ status: { $nin: ['rejected', 'cancelled'] } });
    const counts = {};
    bookings.forEach((b) => {
      const cat = venueMap[String(b.venue)];
      if (!cat) return;
      counts[cat] = (counts[cat] || 0) + 1;
    });
    res.json({ data: counts });
  } catch (err) {
    next(err);
  }
}

async function weeklyVolume(req, res, next) {
  try {
    const bookings = await Booking.find();
    const now = new Date();
    const labels = [];
    const counts = [];
    for (let w = -5; w <= 0; w += 1) {
      labels.push(w === 0 ? 'This wk' : `W${w}`);
      counts.push(0);
    }
    bookings.forEach((b) => {
      const d = new Date(`${b.date}T00:00:00`);
      const diffW = Math.round((d - now) / (1000 * 3600 * 24 * 7));
      const idx = diffW + 5;
      if (idx >= 0 && idx < 6) counts[idx] += 1;
    });
    res.json({ labels, counts });
  } catch (err) {
    next(err);
  }
}

async function roleSplit(req, res, next) {
  try {
    const bookings = await Booking.find({ status: { $nin: ['rejected', 'cancelled'] } });
    const club = bookings.filter((b) => b.userRole === 'club').length;
    const external = bookings.filter((b) => b.userRole === 'external').length;
    res.json({ club, external });
  } catch (err) {
    next(err);
  }
}

async function utilization(req, res, next) {
  try {
    const venues = await Venue.find();
    const bookings = await Booking.find();
    const data = venues.map((v) => {
      const venueBookings = bookings.filter((b) => String(b.venue) === String(v._id));
      const activeCount = venueBookings.filter((b) => b.status !== 'rejected' && b.status !== 'cancelled').length;
      const today = new Date().toISOString().slice(0, 10);
      return {
        venueId: v._id,
        name: v.name,
        bookingCount: activeCount,
        utilizationPct: pricing.utilizationPercent(activeCount),
        demand: pricing.demandLabel(venueBookings, today),
      };
    }).sort((a, b) => b.utilizationPct - a.utilizationPct);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { summary, revenueByVenue, categorySplit, weeklyVolume, roleSplit, utilization };
