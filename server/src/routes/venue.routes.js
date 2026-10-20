const router = require('express').Router();
const ctrl = require('../controllers/venue.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/share/:id', ctrl.getSharedVenue);
router.use(protect);
router.get('/', ctrl.listVenues);
router.get('/:id', ctrl.getVenue);
router.post('/', authorize('manager', 'admin'), ctrl.createVenue);
router.put('/:id', authorize('manager', 'admin'), ctrl.updateVenue);
router.delete('/:id', authorize('manager', 'admin'), ctrl.deleteVenue);

module.exports = router;
