const mongoose = require('mongoose');

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];
const PAYMENT_STATUSES = ['unpaid', 'paid'];

const bookingSchema = new mongoose.Schema(
  {
    venue: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userRole: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    start: { type: String, required: true }, // HH:MM
    end: { type: String, required: true },   // HH:MM
    purpose: { type: String, default: 'Not specified' },
    status: { type: String, enum: STATUSES, default: 'pending' },
    price: { type: Number, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'unpaid' },
  },
  { timestamps: true }
);

bookingSchema.index({ venue: 1, date: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
module.exports.STATUSES = STATUSES;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
