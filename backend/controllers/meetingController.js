const Meeting = require('../models/Meeting');
const MeetingSummary = require('../models/MeetingSummary');
const { createToken, closeRoom } = require('../services/livekit');
const ai = require('../services/aiService');

// Random code in the form "abc-def" (FR-6)
const newMeetingCode = () => {
    const letters = Array.from({ length: 6 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
    return `${letters.slice(0, 3)}-${letters.slice(3)}`;
};

// POST /api/meetings  (FR-5, FR-6)
const createMeeting = async (req, res) => {
    const { name, passcode } = req.body;
    if (passcode && passcode.length > 6) return res.status(400).json({ message: 'Passcode cannot be longer than 6 characters' });

    let meetingId;
    do meetingId = newMeetingCode(); while (await Meeting.exists({ meetingId }));

    const meeting = await Meeting.create({
        meetingId,
        name: name?.trim() || `${req.user.name.split(' ')[0]}'s Meeting`,
        hostId: req.user._id,
        passcode: passcode || null,
        participants: [req.user._id],
    });
    res.status(201).json({ meetingId: meeting.meetingId, name: meeting.name });
};

// POST /api/meetings/:meetingId/join  (FR-7, FR-8, FR-17)
const joinMeeting = async (req, res) => {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) return res.status(404).json({ message: 'Meeting does not exist' });
    if (!meeting.isActive) return res.status(410).json({ message: 'This meeting has ended' });

    const isHost = meeting.hostId.equals(req.user._id);
    if (meeting.passcode && !isHost && req.body.passcode !== meeting.passcode) {
        return res.status(403).json({ requirePasscode: true, message: req.body.passcode ? 'Incorrect passcode' : 'Passcode required' });
    }

    await Meeting.updateOne({ _id: meeting._id }, { $addToSet: { participants: req.user._id } });
    if (isHost) ai.startAgent(meeting.meetingId); // runs in the background so joining is not delayed

    res.json({
        token: await createToken(meeting.meetingId, req.user._id.toString(), req.user.name, {
            canPublish: true, canSubscribe: true, canPublishData: true, canUpdateOwnMetadata: true,
        }),
        livekitUrl: process.env.LIVEKIT_URL,
        meetingName: meeting.name,
        hostId: meeting.hostId,
    });
};

// POST /api/meetings/:meetingId/end  (FR-16, FR-21)
const endMeeting = async (req, res) => {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) return res.status(404).json({ message: 'Meeting does not exist' });
    if (!meeting.hostId.equals(req.user._id)) return res.status(403).json({ message: 'Only the host can end the meeting for everyone' });

    ai.endAgent(meeting.meetingId); // the summary is written in the background
    await closeRoom(meeting.meetingId);
    meeting.isActive = false;
    await meeting.save();
    res.json({ message: 'Meeting ended' });
};

// GET /api/meetings/:meetingId/captions  (FR-19)
const getCaptions = async (req, res) => res.json(await ai.getCaptions(req.params.meetingId));

// GET /api/meetings/history  (FR-25, FR-26)
const getHistory = async (req, res) => {
    const meetings = await Meeting.find({ participants: req.user._id }).sort({ createdAt: -1 }).lean();
    const summaries = await MeetingSummary.find({ meetingId: { $in: meetings.map((m) => m.meetingId) } }).lean();

    res.json(meetings.map((m) => ({
        meetingId: m.meetingId,
        name: m.name,
        date: m.createdAt,
        isActive: m.isActive,
        isHost: m.hostId.equals(req.user._id),
        participants: m.participants.length,
        summary: summaries.find((s) => s.meetingId === m.meetingId) || null,
    })));
};

module.exports = { createMeeting, joinMeeting, endMeeting, getCaptions, getHistory };
