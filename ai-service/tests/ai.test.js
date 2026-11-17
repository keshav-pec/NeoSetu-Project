// Tests for the AI Service modules.
//   npm test                     unit tests only (no network)
//   LIVE=1 npm test              also calls Deepgram and OpenRouter with the keys in .env
// The live speech test needs a 48 kHz mono 16-bit WAV file. On macOS it is generated with `say`.
require('dotenv').config({ quiet: true });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const LIVE = process.env.LIVE === '1';
const realFetch = global.fetch;
const reply = (obj) => ({ status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(obj) } }] }) });

const freshSummary = () => {
    delete require.cache[require.resolve('../src/summary')];
    return require('../src/summary');
};

test('TC-18 long transcripts are summarized in parts and then merged (FR-23)', async () => {
    const prompts = [];
    global.fetch = async (url, opts) => {
        prompts.push(JSON.parse(opts.body).messages[1].content);
        return reply({ summary: 'part', keyPoints: ['k'], actionItems: [] });
    };
    try {
        const transcript = Array.from({ length: 150 }, (_, i) => `Speaker${i % 3}: line ${i}`).join('\n');
        await freshSummary().generateSummary(transcript);
        assert.equal(prompts.length, 4); // 3 parts of 60 lines + 1 merge
        assert.match(prompts[3], /Merge them into one final summary/);
    } finally { global.fetch = realFetch; }
});

test('TC-19 if one AI model fails, the next one is tried (NFR reliability)', async () => {
    const models = [];
    global.fetch = async (url, opts) => {
        models.push(JSON.parse(opts.body).model);
        if (models.length === 1) return { status: 429, json: async () => ({ error: { message: 'rate limited' } }) };
        return reply({ summary: 'ok', keyPoints: [], actionItems: [] });
    };
    try {
        const result = await freshSummary().generateSummary('Host: hello');
        assert.equal(result.summary, 'ok');
        assert.equal(models.length, 2);
        assert.notEqual(models[0], models[1]);
    } finally { global.fetch = realFetch; }
});

test('TC-20 Deepgram turns live speech into caption text (FR-18)', { skip: !LIVE && 'set LIVE=1' }, async (t) => {
    let wav = process.env.SPEECH_WAV;
    if (!wav) {
        if (os.platform() !== 'darwin') return t.skip('set SPEECH_WAV to a 48 kHz mono WAV file');
        wav = path.join(os.tmpdir(), 'neosetu-speech.wav');
        execFileSync('say', ['-v', 'Daniel', '-o', wav, '--file-format=WAVE', '--data-format=LEI16@48000',
            'Good morning everyone. Let us review the sprint. Ujjwal will finish the history page by Friday.']);
    }
    const pcm = fs.readFileSync(wav).subarray(44);
    const { openDeepgram } = require('../src/deepgram');
    const finals = [];
    const t0 = Date.now();
    const socket = openDeepgram((text) => finals.push({ text, at: Date.now() }));
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });

    // Send the audio in real time, 20 ms (1920 bytes) per frame, like a LiveKit AudioStream
    const start = Date.now();
    for (let i = 0; i < pcm.length; i += 1920) {
        socket.send(pcm.subarray(i, i + 1920));
        await new Promise((r) => setTimeout(r, start + (i / 1920 + 1) * 20 - Date.now()));
    }
    const audioEnd = Date.now();
    await new Promise((r) => setTimeout(r, 4000));
    socket.close();

    const text = finals.map((f) => f.text).join(' ').toLowerCase();
    console.log(`  transcript: "${text}"`);
    console.log(`  audio length ${((audioEnd - start) / 1000).toFixed(1)} s, last caption ${finals.at(-1) ? finals.at(-1).at - audioEnd : '-'} ms after the audio ended (connect ${start - t0} ms)`);
    for (const word of ['morning', 'sprint', 'history', 'friday']) assert.ok(text.includes(word), `caption contains "${word}"`);
});

test('TC-21 OpenRouter returns a summary, key points and action items (FR-21, FR-22)', { skip: !LIVE && 'set LIVE=1', timeout: 180000 }, async () => {
    const transcript = [
        'Keshav: Good morning everyone, this is the weekly review of the NeoSetu project.',
        'Ujjwal: The meeting history page is done. It shows the summary, key points and the transcript.',
        'Vaibhav: Captions work, but on slow networks they appear about two seconds late.',
        'Raghav: I tested login and passcodes. Everything passed except one layout problem on small phones.',
        'Keshav: Okay. Raghav, please fix the mobile layout by Thursday.',
        'Raghav: Sure, I will fix it by Thursday.',
        'Keshav: Vaibhav, can you prepare the presentation slides by Saturday?',
        'Vaibhav: Yes, I will share the slides on Saturday.',
        'Keshav: Great. Ujjwal will write the testing chapter of the report. Thanks everyone.',
    ].join('\n');
    const started = Date.now();
    const result = await require('../src/summary').generateSummary(transcript);
    console.log(`  summary generated in ${((Date.now() - started) / 1000).toFixed(1)} s`);
    console.log(`  ${JSON.stringify(result)}`);
    assert.ok(result.summary.length > 20);
    assert.ok(Array.isArray(result.keyPoints) && result.keyPoints.length > 0 && result.keyPoints.length <= 10);
    assert.ok(result.actionItems.length >= 2);
    assert.ok(result.actionItems.every((a) => typeof a.task === 'string'));
});
