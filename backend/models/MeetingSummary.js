const mongoose = require('mongoose');

// Written by the AI Service when a meeting ends, read here for meeting history
const meetingSummarySchema = new mongoose.Schema({
    meetingId: { type: String, required: true, unique: true },
    transcript: { type: String, default: '' },
    summary: { type: String, default: '' },
    keyPoints: [String],
    actionItems: [{ task: String, assignee: String, deadline: String }],
}, { timestamps: true });

module.exports = mongoose.model('MeetingSummary', meetingSummarySchema);
