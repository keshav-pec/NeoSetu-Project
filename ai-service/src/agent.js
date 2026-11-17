const mongoose = require('mongoose');
const { Room, RoomEvent, AudioStream, TrackKind } = require('@livekit/rtc-node');
const { openDeepgram } = require('./deepgram');
const { generateSummary } = require('./summary');
const MeetingSummary = require('./models/MeetingSummary');

const EMPTY_ROOM_DELAY = 15000;   // finish the meeting if the room stays empty this long
const FIRST_JOIN_DELAY = 60000;   // time the host gets to connect after the agent joins
const agents = new Map();         // roomName -> AIAgent

// A hidden participant that listens to one meeting, makes captions and writes the summary
class AIAgent {
    constructor(roomName) {
        this.roomName = roomName;
        this.status = 'connecting';
        this.room = new Room();
        this.captions = [];          // { speaker, text, time } - also the meeting transcript
        this.sockets = new Map();    // participant identity -> Deepgram socket
        this.emptyTimer = null;
    }

    async join(token) {
        agents.set(this.roomName, this);
        this.room
            .on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
                if (track.kind === TrackKind.KIND_AUDIO) this.transcribe(track, participant);
            })
            .on(RoomEvent.ParticipantConnected, () => clearTimeout(this.emptyTimer))
            .on(RoomEvent.ParticipantDisconnected, (participant) => {
                this.closeSocket(participant.identity);
                this.finishWhenEmpty(EMPTY_ROOM_DELAY);
            })
            .on(RoomEvent.Disconnected, () => this.finish()); // e.g. the host closed the room

        try {
            await this.room.connect(process.env.LIVEKIT_URL, token);
        } catch (err) {
            agents.delete(this.roomName);
            throw err;
        }
        this.status = 'listening';
        console.log(`[${this.roomName}] AI agent joined`);
        this.finishWhenEmpty(FIRST_JOIN_DELAY);
    }

    // Streams one speaker's audio to Deepgram and stores the text as captions (FR-18, FR-20)
    async transcribe(track, participant) {
        this.closeSocket(participant.identity);
        const socket = openDeepgram((text) => {
            this.captions.push({ speaker: participant.name || participant.identity, text, time: new Date() });
        });
        this.sockets.set(participant.identity, socket);

        try {
            for await (const frame of new AudioStream(track)) {
                if (socket.readyState === socket.OPEN) {
                    socket.send(Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength));
                }
            }
        } catch (err) {
            console.error(`[${this.roomName}] Audio stream error:`, err.message);
        }
    }

    closeSocket(identity) {
        this.sockets.get(identity)?.close();
        this.sockets.delete(identity);
    }

    finishWhenEmpty(delay) {
        clearTimeout(this.emptyTimer);
        this.emptyTimer = setTimeout(() => {
            if (this.room.remoteParticipants.size === 0) this.finish();
        }, delay);
    }

    // Leaves the room, marks the meeting as ended and saves the summary (FR-21 to FR-24)
    async finish() {
        if (this.status === 'finished') return;
        this.status = 'finished';
        clearTimeout(this.emptyTimer);
        agents.delete(this.roomName);
        [...this.sockets.keys()].forEach((identity) => this.closeSocket(identity));
        await this.room.disconnect().catch(() => {});

        try {
            await mongoose.connection.collection('meetings').updateOne({ meetingId: this.roomName }, { $set: { isActive: false } });

            const transcript = this.captions.map((c) => `${c.speaker}: ${c.text}`).join('\n');
            if (!transcript) return console.log(`[${this.roomName}] Nobody spoke, no summary created`);

            console.log(`[${this.roomName}] Generating summary...`);
            const result = await generateSummary(transcript).catch((err) => {
                console.error(`[${this.roomName}] Summary failed:`, err.message);
                return {};
            });

            await MeetingSummary.findOneAndUpdate({ meetingId: this.roomName }, {
                transcript,
                summary: result.summary || '',
                keyPoints: (result.keyPoints || []).slice(0, 10),
                actionItems: (result.actionItems || []).map((item) => (typeof item === 'string' ? { task: item } : item)),
            }, { upsert: true });
            console.log(`[${this.roomName}] Summary saved`);
        } catch (err) {
            console.error(`[${this.roomName}] Could not finish meeting:`, err.message);
        }
    }
}

module.exports = { AIAgent, agents };
