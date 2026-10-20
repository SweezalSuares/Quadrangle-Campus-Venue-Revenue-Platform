const PricingRule = require('../models/PricingRule');

async function getRules(req, res, next) {
  try {
    let rules = await PricingRule.findOne({ key: 'default' });
    if (!rules) rules = await PricingRule.create({ key: 'default' });
    res.json({ rules });
  } catch (err) {
    next(err);
  }
}

async function updateRules(req, res, next) {
  try {
    const allowed = ['weekend', 'weekday', 'morning', 'afternoon', 'evening', 'demandStep', 'demandCap', 'popularBoost', 'popularCategories'];
    const updates = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });
    const rules = await PricingRule.findOneAndUpdate({ key: 'default' }, updates, { new: true, upsert: true, runValidators: true });
    res.json({ rules });
  } catch (err) {
    next(err);
  }
}

module.exports = { getRules, updateRules };
