const mongoose = require('mongoose');

const meetingSummarySchema = new mongoose.Schema({
    meetingId: { type: String, required: true, unique: true },
    transcript: { type: String, default: '' },
    summary: { type: String, default: '' },
    keyPoints: [String],
    actionItems: [new mongoose.Schema({
        task: String,
        assignee: { type: String, default: 'Unassigned' },
        deadline: { type: String, default: '' },
    }, { _id: false })],
}, { timestamps: true });

module.exports = mongoose.model('MeetingSummary', meetingSummarySchema);
