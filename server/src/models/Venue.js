const mongoose = require('mongoose');

const CATEGORIES = [
  'Auditorium', 'Seminar Hall', 'Sports Ground', 'Lab',
  'Classroom', 'Outdoor Lawn', 'Conference Room', 'Amphitheatre',
];

const coordinatesSchema = new mongoose.Schema(
  {
    lat: { type: Number, min: -90, max: 90, required: true },
    lng: { type: Number, min: -180, max: 180, required: true },
  },
  { _id: false }
);

const venueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, maxlength: 1200, default: '' },
    category: { type: String, enum: CATEGORIES, required: true },
    capacity: { type: Number, required: true, min: 1 },
    location: { type: String, required: true, trim: true },
    coordinates: { type: coordinatesSchema, default: undefined },
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
