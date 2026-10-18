const User = require('../models/User');
const Booking = require('../models/Booking');

async function listUsers(req, res, next) {
  try {
    const users = await User.find().sort({ createdAt: 1 });
    const counts = await Booking.aggregate([{ $group: { _id: '$user', count: { $sum: 1 } } }]);
    const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
    res.json({
      users: users.map((u) => ({ ...u.toSafeObject(), bookingCount: countMap[String(u._id)] || 0 })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers };
