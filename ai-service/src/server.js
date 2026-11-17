require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { AIAgent, agents } = require('./agent');

const app = express();
app.use(express.json());

app.get('/', (req, res) => res.json({ message: 'NeoSetu AI Service is running', activeMeetings: agents.size }));

// Only the NeoSetu backend (which knows the shared key) may use the routes below
app.use('/api', (req, res, next) => {
    if (req.get('x-api-key') !== process.env.AI_SERVICE_KEY) return res.status(401).json({ message: 'Unauthorized' });
    next();
});

// Start an AI agent in a meeting room
app.post('/api/agent/join', async (req, res) => {
    const { roomName, token } = req.body;
    if (!roomName || !token) return res.status(400).json({ message: 'roomName and token are required' });
    if (!agents.has(roomName)) await new AIAgent(roomName).join(token);
    res.json({ message: `AI agent is listening in ${roomName}` });
});

// Finish the meeting: save transcript and summary, then leave the room
app.post('/api/agent/end', async (req, res) => {
    await agents.get(req.body.roomName)?.finish();
    res.json({ message: 'Meeting finished' });
});

// Live captions of a running meeting
app.get('/api/captions/:roomName', (req, res) => res.json(agents.get(req.params.roomName)?.captions || []));

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: err.message });
});

const PORT = process.env.PORT || 5001;
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB connected');
        app.listen(PORT, () => console.log(`NeoSetu AI Service running on port ${PORT}`));
    })
    .catch((err) => {
        console.error('MongoDB connection failed:', err.message);
        process.exit(1);
    });
