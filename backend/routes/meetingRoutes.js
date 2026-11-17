const router = require('express').Router();
const { createMeeting, joinMeeting, endMeeting, getCaptions, getHistory } = require('../controllers/meetingController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // every meeting route needs a logged-in user

router.post('/', createMeeting);
router.get('/history', getHistory);
router.post('/:meetingId/join', joinMeeting);
router.post('/:meetingId/end', endMeeting);
router.get('/:meetingId/captions', getCaptions);

module.exports = router;
