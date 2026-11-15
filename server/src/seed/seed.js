/**
 * Clears venues, bookings and notifications while preserving users and pricing
 * rules. Missing demo accounts and the default pricing rule are created.
 * Run with: npm run seed
 */
require('dotenv').config();
const { connectDB } = require('../config/db');
const mongoose = require('mongoose');
const User = require('../models/User');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const PricingRule = require('../models/PricingRule');

const DEMO_USERS = [
  { name: 'System Admin', email: 'admin@christuniversity.in', password: 'admin123', role: 'admin' },
  { name: 'Rajesh Kumar', email: 'manager@christuniversity.in', password: 'manager123', role: 'manager' },
  { name: 'Priya S — Tech Club', email: 'club@christuniversity.in', password: 'club123', role: 'club' },
  { name: 'Bangalore Events Co.', email: 'client@example.com', password: 'client123', role: 'external' },
];

async function run() {
  await connectDB();
  console.log('[seed] clearing venues, bookings and notifications...');
  await Promise.all([
    Venue.deleteMany({}),
    Booking.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  console.log('[seed] preserving existing users and creating missing demo accounts...');
  const users = [];
  for (const u of DEMO_USERS) {
    const existing = await User.findOne({ email: u.email });
    users.push(existing || await User.create(u)); // password hashed via pre-save hook
  }

  console.log('[seed] ensuring default pricing rules...');
  if (!await PricingRule.findOne({ key: 'default' })) {
    await PricingRule.create({ key: 'default' });
  }

  console.log(`[seed] done — ${users.length} demo accounts available; venues and bookings are empty.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
