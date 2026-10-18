/**
 * Seeds demo users, venues, a pricing-rule document and a spread of sample
 * bookings so the dashboards and analytics charts have something to show.
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
const pricing = require('../services/pricing.service');

const DEMO_USERS = [
  { name: 'System Admin', email: 'admin@christuniversity.in', password: 'admin123', role: 'admin' },
  { name: 'Rajesh Kumar', email: 'manager@christuniversity.in', password: 'manager123', role: 'manager' },
  { name: 'Priya S — Tech Club', email: 'club@christuniversity.in', password: 'club123', role: 'club' },
  { name: 'Bangalore Events Co.', email: 'client@example.com', password: 'client123', role: 'external' },
];

const DEMO_VENUES = [
  { name: 'Centre for Performing Arts — Auditorium', category: 'Auditorium', capacity: 500, location: 'Block 1, Ground Floor', incharge: 'Prof. Anita Rao', equipment: ['Stage lighting', 'Line array PA', '4K projector', 'Green rooms'], basePrice: 15000, imageSeed: 'auditorium1' },
  { name: 'Seminar Hall A', category: 'Seminar Hall', capacity: 120, location: 'Block 3, 2nd Floor', incharge: 'Mr. Suresh Iyer', equipment: ['Podium', 'Mic set', 'Projector'], basePrice: 4500, imageSeed: 'seminar1' },
  { name: 'Seminar Hall B', category: 'Seminar Hall', capacity: 80, location: 'Block 3, 2nd Floor', incharge: 'Mr. Suresh Iyer', equipment: ['Podium', 'Whiteboard', 'Projector'], basePrice: 3200, imageSeed: 'seminar2' },
  { name: 'Basketball Court', category: 'Sports Ground', capacity: 200, location: 'Sports Complex', incharge: "Coach D'Souza", equipment: ['Floodlights', 'Scoreboard'], basePrice: 6000, imageSeed: 'court1' },
  { name: 'Main Football Ground', category: 'Sports Ground', capacity: 1000, location: 'East Campus', incharge: "Coach D'Souza", equipment: ['Floodlights', 'Turf crew'], basePrice: 18000, imageSeed: 'ground1' },
  { name: 'AI & Robotics Lab', category: 'Lab', capacity: 40, location: 'Block 5, 3rd Floor', incharge: 'Dr. Meenal Joshi', equipment: ['GPU workstations', 'Robotics kits'], basePrice: 5000, imageSeed: 'lab1' },
  { name: 'Smart Classroom 204', category: 'Classroom', capacity: 60, location: 'Block 2, 2nd Floor', incharge: 'Ms. Farah Khan', equipment: ['Smartboard', 'AC', 'Podium'], basePrice: 2500, imageSeed: 'class1' },
  { name: 'Open Air Amphitheatre', category: 'Amphitheatre', capacity: 800, location: 'Central Quad', incharge: 'Prof. Anita Rao', equipment: ['Stage', 'PA system'], basePrice: 12000, imageSeed: 'amphi1' },
  { name: 'Admin Block Conference Room', category: 'Conference Room', capacity: 25, location: 'Admin Block, 1st Floor', incharge: 'Mr. Vinod Nair', equipment: ['Video conferencing', 'Whiteboard'], basePrice: 2800, imageSeed: 'conf1' },
  { name: 'Central Lawn', category: 'Outdoor Lawn', capacity: 1500, location: 'Front Campus', incharge: 'Mr. Vinod Nair', equipment: ['Power points', 'Water access'], basePrice: 9000, imageSeed: 'lawn1' },
];

function isoDate(d) { return d.toISOString().slice(0, 10); }

async function run() {
  await connectDB();
  console.log('[seed] clearing existing collections...');
  await Promise.all([
    User.deleteMany({}),
    Venue.deleteMany({}),
    Booking.deleteMany({}),
    Notification.deleteMany({}),
    PricingRule.deleteMany({}),
  ]);

  console.log('[seed] creating users...');
  const users = [];
  for (const u of DEMO_USERS) {
    users.push(await User.create(u)); // password hashed via pre-save hook
  }
  const managerLike = users.filter((u) => ['manager', 'admin'].includes(u.role));
  const clubUser = users.find((u) => u.role === 'club');
  const externalUser = users.find((u) => u.role === 'external');

  console.log('[seed] creating venues...');
  const venues = [];
  for (const v of DEMO_VENUES) {
    venues.push(await Venue.create({ ...v, createdBy: managerLike[0]._id }));
  }

  console.log('[seed] creating pricing rules...');
  const rules = await PricingRule.create({ key: 'default' });

  console.log('[seed] creating sample bookings for analytics...');
  const today = new Date();
  const statuses = ['approved', 'approved', 'approved', 'pending', 'rejected', 'cancelled'];
  const hours = [9, 11, 14, 16, 18];
  let created = 0;

  for (let w = -5; w <= 1; w += 1) {
    for (let idx = 0; idx < venues.length; idx += 1) {
      if ((idx + w) % 3 !== 0) continue; // sparsify so it doesn't overwhelm
      const v = venues[idx];
      const day = new Date(today);
      day.setDate(day.getDate() + w * 7 + (idx % 5));
      const dateStr = isoDate(day);
      const startH = hours[(idx + w + 5 + hours.length * 10) % hours.length];
      const user = (idx + w) % 2 === 0 ? clubUser : externalUser;
      const status = w < 0 ? statuses[(idx + w + 600) % statuses.length] : 'pending';

      const venueBookingsSoFar = await Booking.find({ venue: v._id });
      const price = pricing.computePrice(v, dateStr, `${startH}:00`, venueBookingsSoFar, rules);

      await Booking.create({
        venue: v._id,
        user: user._id,
        userRole: user.role,
        date: dateStr,
        start: `${startH}:00`,
        end: `${startH + 2}:00`,
        purpose: user.role === 'club' ? 'Club activity / workshop' : 'External rental event',
        status,
        price,
        paymentStatus: status === 'approved' ? (created % 2 === 0 ? 'paid' : 'unpaid') : 'unpaid',
      });
      created += 1;
    }
  }

  console.log('[seed] creating a welcome notification for each user...');
  for (const u of users) {
    await Notification.create({ user: u._id, text: `Welcome to Quadrangle, ${u.name.split(' ')[0]}.`, type: 'info' });
  }

  console.log(`[seed] done — ${users.length} users, ${venues.length} venues, ${created} bookings.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
