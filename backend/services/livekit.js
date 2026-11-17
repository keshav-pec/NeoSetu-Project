const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');

// Creates a LiveKit access token for one person (or the AI agent) in one room
const createToken = (room, identity, name, grants = {}) => {
    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity, name, ttl: '4h' });
    at.addGrant({ roomJoin: true, room, ...grants });
    return at.toJwt();
};

// Closes the room, which disconnects everyone in it
const closeRoom = async (room) => {
    const service = new RoomServiceClient(
        process.env.LIVEKIT_URL.replace(/^ws/, 'http'),
        process.env.LIVEKIT_API_KEY,
        process.env.LIVEKIT_API_SECRET,
    );
    await service.deleteRoom(room).catch((err) => console.warn(`[LiveKit] Could not close ${room}: ${err.message}`));
};

module.exports = { createToken, closeRoom };
