const mongoose = require('mongoose');

const CATEGORIES = [
  'Auditorium', 'Seminar Hall', 'Sports Ground', 'Lab',
  'Classroom', 'Outdoor Lawn', 'Conference Room', 'Amphitheatre',
];

const venueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, required: true },
    capacity: { type: Number, required: true, min: 1 },
    location: { type: String, required: true, trim: true },
    incharge: { type: String, required: true, trim: true },
    equipment: { type: [String], default: [] },
    basePrice: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, default: '' },
    imageSeed: { type: String, default: 'venue' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

venueSchema.index({ name: 'text', location: 'text' });

module.exports = mongoose.model('Venue', venueSchema);
module.exports.CATEGORIES = CATEGORIES;
