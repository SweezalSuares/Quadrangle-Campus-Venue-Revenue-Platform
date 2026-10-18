const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', ctrl.listNotifications);
router.patch('/read-all', ctrl.markAllRead);

module.exports = router;
