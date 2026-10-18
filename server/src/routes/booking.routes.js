const router = require('express').Router();
const ctrl = require('../controllers/booking.controller');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/quote', ctrl.quote);
router.get('/', ctrl.listBookings);
router.post('/', ctrl.createBooking);
router.patch('/:id/status', ctrl.setStatus);
router.patch('/:id/pay', ctrl.markPaid);
router.get('/:id/payment-qr', ctrl.paymentQr);

module.exports = router;
