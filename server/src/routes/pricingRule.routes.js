const router = require('express').Router();
const ctrl = require('../controllers/pricingRule.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));
router.get('/', ctrl.getRules);
router.put('/', ctrl.updateRules);

module.exports = router;
