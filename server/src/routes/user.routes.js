const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));
router.get('/', ctrl.listUsers);

module.exports = router;
