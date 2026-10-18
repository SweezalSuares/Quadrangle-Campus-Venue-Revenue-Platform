const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');

function getVenuePayload(req) {
  const payload = { ...req.body };
  if (typeof payload.equipment === 'string') {
    try {
      payload.equipment = JSON.parse(payload.equipment);
    } catch (err) {
      const invalidEquipment = new Error('Equipment list must be valid JSON.');
      invalidEquipment.statusCode = 400;
      throw invalidEquipment;
    }
  }
  if (req.file) payload.imageUrl = `/uploads/${req.file.filename}`;
  return payload;
}

async function getSharedVenue(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Venue not found.' });
    }
    const venue = await Venue.findById(req.params.id)
      .select('name category capacity location incharge equipment basePrice imageUrl imageSeed');
    if (!venue) return res.status(404).json({ message: 'Venue not found.' });
    res.json({ venue });
  } catch (err) {
    next(err);
  }
}

async function listVenues(req, res, next) {
  try {
    const { search, category, minCapacity } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (minCapacity) filter.capacity = { $gte: Number(minCapacity) };
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { location: new RegExp(search, 'i') },
      ];
    }
    const venues = await Venue.find(filter).sort({ createdAt: 1 });
    res.json({ venues });
  } catch (err) {
    next(err);
  }
}

async function getVenue(req, res, next) {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) return res.status(404).json({ message: 'Venue not found.' });
    res.json({ venue });
  } catch (err) {
    next(err);
  }
}

async function createVenue(req, res, next) {
  try {
    const payload = { ...getVenuePayload(req), createdBy: req.user._id };
    const venue = await Venue.create(payload);
    res.status(201).json({ venue });
  } catch (err) {
    next(err);
  }
}

async function updateVenue(req, res, next) {
  try {
    const venue = await Venue.findByIdAndUpdate(req.params.id, getVenuePayload(req), { new: true, runValidators: true });
    if (!venue) return res.status(404).json({ message: 'Venue not found.' });
    res.json({ venue });
  } catch (err) {
    next(err);
  }
}

async function deleteVenue(req, res, next) {
  try {
    const venue = await Venue.findByIdAndDelete(req.params.id);
    if (!venue) return res.status(404).json({ message: 'Venue not found.' });
    // Existing bookings are kept on record for history/analytics — only the listing is removed.
    res.json({ message: 'Venue removed.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSharedVenue, listVenues, getVenue, createVenue, updateVenue, deleteVenue };
