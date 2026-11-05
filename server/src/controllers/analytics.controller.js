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
    const [venues, revenues] = await Promise.all([
      Venue.find().select('name'),
      Booking.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: '$venue', revenue: { $sum: '$price' } } },
      ]),
    ]);
    const revenueById = new Map(revenues.map((item) => [String(item._id), item.revenue]));
    const data = venues.map((v) => ({
      venueId: v._id,
      name: v.name,
      revenue: revenueById.get(String(v._id)) || 0,
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
    const today = new Date();
    const currentWeekStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - ((currentWeekStart.getUTCDay() + 6) % 7));
    const labels = [];
    const counts = [];
    for (let index = 0; index < 6; index += 1) {
      const start = new Date(currentWeekStart);
      start.setUTCDate(start.getUTCDate() - (5 - index) * 7);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 7);
      labels.push(start.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'UTC' }));
      counts.push(bookings.filter((booking) => {
        if (booking.status === 'rejected' || booking.status === 'cancelled') return false;
        const date = booking.date;
        return date >= start.toISOString().slice(0, 10) && date < end.toISOString().slice(0, 10);
      }).length);
    }
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
      const forecast = pricing.utilizationForecast(venueBookings);
      const activeCount = forecast.reduce((sum, slot) => sum + slot.historicalBookings, 0);
      const today = new Date().toISOString().slice(0, 10);
      return {
        venueId: v._id,
        name: v.name,
        bookingCount: activeCount,
        utilizationPct: Math.min(100, Math.round((activeCount / 252) * 100)),
        demand: pricing.demandLabel(venueBookings, today),
        slotForecast: forecast,
      };
    }).sort((a, b) => b.utilizationPct - a.utilizationPct);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { summary, revenueByVenue, categorySplit, weeklyVolume, roleSplit, utilization };
