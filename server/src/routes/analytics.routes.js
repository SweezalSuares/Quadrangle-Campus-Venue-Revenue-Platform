const router = require('express').Router();
const ctrl = require('../controllers/analytics.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('manager', 'admin'));
router.get('/summary', ctrl.summary);
router.get('/revenue-by-venue', ctrl.revenueByVenue);
router.get('/category-split', ctrl.categorySplit);
router.get('/weekly-volume', ctrl.weeklyVolume);
router.get('/role-split', ctrl.roleSplit);
router.get('/utilization', ctrl.utilization);

module.exports = router;
