// If one model fails, the next one is tried. "openrouter/free" picks any free model that is available.
const MODELS = [...new Set([
    process.env.OPENROUTER_MODEL,
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'openrouter/free',
])].filter(Boolean);

const LINES_PER_PART = 60; // long transcripts are summarized in parts (FR-23)

const SYSTEM_PROMPT = `You are NeoSetu AI, a meeting assistant. Summarize the meeting transcript you are given.
Rules:
- Use only information from the transcript. Do not invent facts or tasks.
- Ignore filler words, repetitions and transcription mistakes.
- Write in English, in a short and professional style.
- "summary": 1 to 3 short paragraphs about the overall discussion.
- "keyPoints": the most important points, at most 10, without duplicates.
- "actionItems": only tasks someone clearly agreed to do. Use "Unassigned" if the person is unknown and "" if there is no deadline. Use [] if there are none.
Return ONLY valid JSON (no markdown) in exactly this format:
{"summary":"","keyPoints":[],"actionItems":[{"task":"","assignee":"","deadline":""}]}`;

async function ask(content) {
    for (const model of MODELS) {
        try {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    temperature: 0.3,
                    messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content }],
                }),
            });
            const data = await res.json();
            const text = data.choices?.[0]?.message?.content;
            if (!text) throw new Error(data.error?.message || `HTTP ${res.status}`);
            return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
        } catch (err) {
            console.warn(`[OpenRouter] ${model} failed: ${err.message}`);
        }
    }
    throw new Error('All AI models failed');
}

// Returns { summary, keyPoints, actionItems } for a transcript (FR-21 to FR-23)
async function generateSummary(transcript) {
    const lines = transcript.split('\n');
    if (lines.length <= LINES_PER_PART) return ask(`Meeting transcript:\n${transcript}`);

    const parts = [];
    for (let i = 0; i < lines.length; i += LINES_PER_PART) {
        console.log(`Summarizing part ${parts.length + 1} of ${Math.ceil(lines.length / LINES_PER_PART)}`);
        parts.push(await ask(`Meeting transcript (one part of a longer meeting):\n${lines.slice(i, i + LINES_PER_PART).join('\n')}`));
    }
    return ask(`These are summaries of consecutive parts of ONE meeting. Merge them into one final summary and remove duplicates:\n${JSON.stringify(parts)}`);
}

module.exports = { generateSummary };
