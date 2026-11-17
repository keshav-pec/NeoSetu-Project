const WebSocket = require('ws');

const DEEPGRAM_URL = 'wss://api.deepgram.com/v1/listen?model=nova-3&language=multi&smart_format=true'
    + '&encoding=linear16&sample_rate=48000&channels=1';

// Opens a live speech-to-text connection; onText is called with every finished sentence
function openDeepgram(onText) {
    const socket = new WebSocket(DEEPGRAM_URL, { headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` } });

    // Deepgram closes idle connections, so keep it open while the speaker is muted
    const keepAlive = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'KeepAlive' }));
    }, 5000);

    socket.on('message', (message) => {
        const data = JSON.parse(message.toString());
        const text = data.channel?.alternatives?.[0]?.transcript?.trim();
        if (data.is_final && text) onText(text);
    });
    socket.on('error', (err) => console.error('Deepgram error:', err.message));
    socket.on('close', () => clearInterval(keepAlive));
    return socket;
}

module.exports = { openDeepgram };
