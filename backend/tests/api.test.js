// API tests for the NeoSetu backend (black-box, over HTTP).
// Start the backend and the AI Service first, then run:
//   API_URL=http://localhost:8080/api AI_URL=http://localhost:5001 npm test
// If MONGO_URI is set, TC-04 also checks the stored password hash in the database.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const API = process.env.API_URL || 'http://localhost:8080/api';
const AI = process.env.AI_URL || 'http://localhost:5001';
const stamp = Date.now();

async function call(method, path, body, token) {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: body && JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
}

const host = { name: 'Test Host', email: `host${stamp}@neosetu.test`, password: 'secret123' };
const guest = { name: 'Test Guest', email: `guest${stamp}@neosetu.test`, password: 'secret456' };
let hostToken, guestToken, openCode, lockedCode;

test('TC-01 register a new user (FR-1)', async () => {
    const r = await call('POST', '/auth/register', host);
    assert.equal(r.status, 201);
    assert.ok(r.body.token);
    hostToken = r.body.token;
    guestToken = (await call('POST', '/auth/register', guest)).body.token;
});

test('TC-02 reject a duplicate email (FR-1)', async () => {
    const r = await call('POST', '/auth/register', host);
    assert.equal(r.status, 400);
    assert.equal(r.body.message, 'User already exists');
});

test('TC-03 reject registration with missing fields (FR-1)', async () => {
    const r = await call('POST', '/auth/register', { email: 'x@neosetu.test' });
    assert.equal(r.status, 400);
});

test('TC-04 password is stored as a bcrypt hash (FR-3)', async (t) => {
    if (!process.env.MONGO_URI) return t.skip('MONGO_URI not set');
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGO_URI);
    const user = await mongoose.connection.collection('users').findOne({ email: host.email });
    await mongoose.disconnect();
    assert.notEqual(user.password, host.password);
    assert.match(user.password, /^\$2[aby]\$10\$/);
});

test('TC-05 log in with the correct password (FR-2)', async () => {
    const r = await call('POST', '/auth/login', { email: host.email, password: host.password });
    assert.equal(r.status, 200);
    assert.equal(r.body.email, host.email);
    assert.ok(r.body.token);
});

test('TC-06 reject a wrong password (FR-2)', async () => {
    const r = await call('POST', '/auth/login', { email: host.email, password: 'wrong' });
    assert.equal(r.status, 401);
});

test('TC-07 protected routes need a valid token (FR-4)', async () => {
    assert.equal((await call('GET', '/meetings/history')).status, 401);
    assert.equal((await call('POST', '/meetings', {}, 'not-a-token')).status, 401);
});

test('TC-08 create a meeting with a unique code (FR-5, FR-6)', async () => {
    const r = await call('POST', '/meetings', { name: 'Sprint Review' }, hostToken);
    assert.equal(r.status, 201);
    assert.match(r.body.meetingId, /^[a-z]{3}-[a-z]{3}$/);
    openCode = r.body.meetingId;
    const second = await call('POST', '/meetings', { passcode: 'pec123' }, hostToken);
    assert.notEqual(second.body.meetingId, openCode);
    lockedCode = second.body.meetingId;
});

test('TC-09 reject a passcode longer than 6 characters (FR-5)', async () => {
    const r = await call('POST', '/meetings', { passcode: '1234567' }, hostToken);
    assert.equal(r.status, 400);
});

test('TC-10 joining a wrong code shows "Meeting does not exist" (FR-7)', async () => {
    const r = await call('POST', '/meetings/zzz-zzz/join', {}, guestToken);
    assert.equal(r.status, 404);
    assert.equal(r.body.message, 'Meeting does not exist');
});

test('TC-11 passcode is required for a protected meeting (FR-8)', async () => {
    const none = await call('POST', `/meetings/${lockedCode}/join`, {}, guestToken);
    assert.equal(none.status, 403);
    assert.equal(none.body.requirePasscode, true);
    const wrong = await call('POST', `/meetings/${lockedCode}/join`, { passcode: 'nope' }, guestToken);
    assert.equal(wrong.body.message, 'Incorrect passcode');
});

test('TC-12 correct passcode returns a LiveKit token for that room (FR-8, FR-9)', async () => {
    const r = await call('POST', `/meetings/${lockedCode}/join`, { passcode: 'pec123' }, guestToken);
    assert.equal(r.status, 200);
    assert.match(r.body.livekitUrl, /^wss?:\/\//);
    const grant = JSON.parse(Buffer.from(r.body.token.split('.')[1], 'base64url').toString());
    assert.equal(grant.video.room, lockedCode);
    assert.equal(grant.video.roomJoin, true);
});

test('TC-13 the host joins without the passcode (FR-8, FR-17)', async () => {
    const r = await call('POST', `/meetings/${lockedCode}/join`, {}, hostToken);
    assert.equal(r.status, 200);
});

test('TC-14 only the host can end the meeting (FR-16)', async () => {
    const r = await call('POST', `/meetings/${lockedCode}/end`, {}, guestToken);
    assert.equal(r.status, 403);
});

test('TC-15 host ends the meeting; it can no longer be joined (FR-16)', async () => {
    assert.equal((await call('POST', `/meetings/${lockedCode}/end`, {}, hostToken)).status, 200);
    const r = await call('POST', `/meetings/${lockedCode}/join`, { passcode: 'pec123' }, guestToken);
    assert.equal(r.status, 410);
});

test('TC-16 history lists meetings the user hosted or joined (FR-25)', async () => {
    const r = await call('GET', '/meetings/history', null, guestToken);
    assert.equal(r.status, 200);
    const m = r.body.find((x) => x.meetingId === lockedCode);
    assert.ok(m, 'joined meeting is in the guest history');
    assert.equal(m.isHost, false);
    assert.equal(m.participants, 2);
    assert.equal(m.isActive, false);
    assert.ok(!r.body.some((x) => x.meetingId === openCode), 'meetings the guest never joined are hidden');
});

test('TC-17 the AI Service rejects calls without the shared key', async () => {
    const res = await fetch(`${AI}/api/captions/${openCode}`);
    assert.equal(res.status, 401);
});
