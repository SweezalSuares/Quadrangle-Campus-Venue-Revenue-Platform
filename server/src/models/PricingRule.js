const mongoose = require('mongoose');

// Singleton document holding the weights that drive the AI dynamic-pricing formula.
const pricingRuleSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    weekend: { type: Number, default: 0.30 },
    weekday: { type: Number, default: 0.05 },
    morning: { type: Number, default: 0.08 },
    afternoon: { type: Number, default: 0.04 },
    evening: { type: Number, default: 0.28 },
    demandStep: { type: Number, default: 0.04 },
    demandCap: { type: Number, default: 0.30 },
    popularBoost: { type: Number, default: 0.12 },
    popularCategories: { type: [String], default: ['Auditorium', 'Amphitheatre', 'Sports Ground'] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PricingRule', pricingRuleSchema);
