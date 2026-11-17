const { createToken } = require('./livekit');

const callAI = async (path, body) => {
    const res = await fetch(`${process.env.AI_SERVICE_URL || 'http://localhost:5001'}/api${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.AI_SERVICE_KEY || '' },
        body: body && JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`AI Service responded with ${res.status}`);
    return res.json();
};

// Sends the AI agent into the room as a hidden, listen-only participant (FR-17)
const startAgent = async (roomName) => {
    try {
        const token = await createToken(roomName, 'neosetu-ai', 'NeoSetu AI', { hidden: true, canPublish: false, canSubscribe: true });
        await callAI('/agent/join', { roomName, token });
    } catch (err) {
        console.error(`[AI] Could not start agent for ${roomName}: ${err.message}`);
    }
};

// Asks the AI agent to finish the transcript and write the summary (FR-21)
const endAgent = (roomName) => callAI('/agent/end', { roomName })
    .catch((err) => console.error(`[AI] Could not end agent for ${roomName}: ${err.message}`));

const getCaptions = (roomName) => callAI(`/captions/${encodeURIComponent(roomName)}`).catch(() => []);

module.exports = { startAgent, endAgent, getCaptions };
