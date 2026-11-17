const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
    meetingId: { type: String, required: true, unique: true }, // e.g. "kqz-bmt"
    name: { type: String, required: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    passcode: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // everyone who joined, host included
}, { timestamps: true });

module.exports = mongoose.model('Meeting', meetingSchema);
