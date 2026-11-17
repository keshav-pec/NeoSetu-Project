const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// At most 20 login/register attempts per IP every 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: 'Too many attempts, please try again in 15 minutes' },
});

router.post('/register', limiter, register);
router.post('/login', limiter, login);
router.get('/me', protect, getMe);

module.exports = router;
