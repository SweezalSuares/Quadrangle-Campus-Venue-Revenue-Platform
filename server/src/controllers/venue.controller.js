const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');

const CAMPUS_CENTER = { lat: 12.9337799, lng: 77.6051605 };

async function getSharedVenue(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Venue not found.' });
    }
    const venue = await Venue.findById(req.params.id)
      .select('name description category capacity location incharge equipment basePrice imageUrl imageSeed');
    if (!venue) return res.status(404).json({ message: 'Venue not found.' });
    res.json({ venue });
  } catch (err) {
    next(err);
  }
}

async function mapVenues(req, res, next) {
  try {
    const venues = await Venue.find()
      .select('name category location capacity coordinates')
      .sort({ createdAt: 1 });
    res.json({
      venues: venues.map((venue) => ({
        _id: venue._id,
        name: venue.name,
        category: venue.category,
        location: venue.location,
        capacity: venue.capacity,
        coordinates: venue.coordinates || CAMPUS_CENTER,
        approximate: !venue.coordinates,
      })),
    });
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
    const payload = { ...req.body, createdBy: req.user._id };
    const venue = await Venue.create(payload);
    res.status(201).json({ venue });
  } catch (err) {
    next(err);
  }
}

async function updateVenue(req, res, next) {
  try {
    const venue = await Venue.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
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

module.exports = { getSharedVenue, mapVenues, listVenues, getVenue, createVenue, updateVenue, deleteVenue };
