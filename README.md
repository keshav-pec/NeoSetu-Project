# NeoSetu

**An AI-Powered Real-Time Video Conferencing Platform** (SE Lab Project)

Users can create or join video meetings with audio, video, screen sharing, chat, reactions and host controls. A hidden **AI agent** joins every meeting. It turns speech into **live captions**, and when the meeting ends it writes a **summary** with key points and action items. Everyone who attended can read the summary later on the History page.

## Architecture

| Part | What it does | Technology | Hosted on |
|---|---|---|---|
| `frontend/` | Login and register pages, home page, meeting room, meeting history | React 18, Vite, Tailwind CSS, Zustand, LiveKit Components | Vercel |
| `backend/` | User accounts, creating and joining meetings, host checks, meeting history | Node.js, Express, MongoDB (Mongoose), LiveKit Server SDK | Render |
| `ai-service/` | Hidden AI agent: live captions (Deepgram) and summaries (OpenRouter) | Node.js, Express, LiveKit RTC Node, Deepgram, OpenRouter | Render |
| LiveKit | Carries audio, video, screen sharing and chat | LiveKit Cloud (WebRTC) | LiveKit Cloud |
| Database | Users, meetings, summaries | MongoDB Atlas | MongoDB Atlas |

```
Browser ──> Frontend (Vercel) ──> Backend (Render) ──> AI Service (Render) ──> Deepgram / OpenRouter
   │                                   │                     │
   └──── audio / video / chat ───> LiveKit Cloud <── listens ─┘
                                       MongoDB Atlas <── Backend + AI Service
```

**How a meeting works**
1. The host creates a meeting and gets a code such as `kqz-bmt`. The meeting can have a passcode.
2. When someone joins, the backend checks the code and passcode, then returns a LiveKit token. When the host joins, the backend also starts the AI agent.
3. The AI agent joins the LiveKit room as a **hidden, listen-only** participant. It streams each speaker's audio to Deepgram and keeps the captions in memory. The website polls `/captions` every second.
4. When the host clicks **End meeting for all**, the backend closes the room. The AI agent sends the transcript to OpenRouter in parts, saves the summary to MongoDB and leaves. The meeting also ends automatically if the room stays empty.

## Project structure

```
NeoSetu/
├── backend/
│   ├── index.js                  # Express app and MongoDB connection
│   ├── models/                   # User, Meeting, MeetingSummary
│   ├── controllers/              # authController, meetingController
│   ├── routes/                   # /api/auth, /api/meetings
│   ├── middleware/               # JWT protection
│   └── services/                 # livekit.js (tokens, close room), aiService.js (calls the AI Service)
├── ai-service/
│   └── src/
│       ├── server.js             # Express app: join, end and captions routes
│       ├── agent.js              # AIAgent class: joins the room, transcribes, finishes the meeting
│       ├── deepgram.js           # Live speech-to-text connection
│       ├── summary.js            # OpenRouter summary with chunking and model fallback
│       └── models/MeetingSummary.js
└── frontend/
    └── src/
        ├── api.js, store.js      # Axios API calls, Zustand stores (auth, theme)
        ├── pages/                # Home, Auth (login/register), MeetingRoom, History
        └── components/           # Navbar, room/ (Room, VideoTile, Panels)
```

## API

All routes except register, login and health need the header `Authorization: Bearer <token>`.

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Register with name, email and password |
| POST | `/api/auth/login` | Log in, returns a JWT |
| GET | `/api/auth/me` | Logged-in user |
| POST | `/api/meetings` | Create a meeting `{ name?, passcode? }` |
| POST | `/api/meetings/:meetingId/join` | Check code and passcode, get a LiveKit token (starts the AI agent for the host) |
| POST | `/api/meetings/:meetingId/end` | Host only: end the meeting for everyone and generate the summary |
| GET | `/api/meetings/:meetingId/captions` | Live captions of a running meeting |
| GET | `/api/meetings/history` | Meetings the user hosted or joined, with summaries |

The AI Service is called only by the backend. Its routes need the `x-api-key` header, which must match `AI_SERVICE_KEY`: `POST /api/agent/join`, `POST /api/agent/end`, `GET /api/captions/:roomName`.

## Environment variables

Each part has a `.env` file (not committed) and a `.env.example`. The values that are still empty must be filled in:

| Part | Variable | Value |
|---|---|---|
| backend | `MONGO_URI` | MongoDB Atlas connection string |
| backend | `CLIENT_URL` | Vercel URL of the frontend, e.g. `https://neosetu.vercel.app` (empty allows any origin) |
| backend | `AI_SERVICE_URL` | Render URL of the AI Service, e.g. `https://neosetu-ai.onrender.com` |
| ai-service | `MONGO_URI` | The same MongoDB Atlas connection string |
| frontend | `VITE_API_URL` | Render URL of the backend **with `/api`**, e.g. `https://neosetu-backend.onrender.com/api` |

Already filled in: `JWT_SECRET`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `AI_SERVICE_KEY` (the same value in the backend and the AI Service), `DEEPGRAM_API_KEY`, `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`.

## Run locally

Requires Node.js 20 or newer. Fill in `MONGO_URI` in `backend/.env` and `ai-service/.env` first.

```bash
cd backend    && npm install && npm run dev   # http://localhost:8080
cd ai-service && npm install && npm run dev   # http://localhost:5001
cd frontend   && npm install && npm run dev   # http://localhost:5173
```

When the Render and Vercel URLs are empty, the parts find each other on localhost automatically.

## Deployment

**1. MongoDB Atlas**: create a cluster, create a database user, allow access from `0.0.0.0/0` (Render has no fixed IP), and copy the connection string.

**2. AI Service on Render**: New → Web Service → connect the GitHub repository.
- Root Directory: `ai-service` · Runtime: Node · Build Command: `npm install` · Start Command: `npm start`
- Environment: every variable from `ai-service/.env`, with `MONGO_URI` filled in.

**3. Backend on Render**: New → Web Service → same repository.
- Root Directory: `backend` · Build Command: `npm install` · Start Command: `npm start` · Health Check Path: `/api/health`
- Environment: every variable from `backend/.env`. Set `AI_SERVICE_URL` to the AI Service URL from step 2.

**4. Frontend on Vercel**: Add New → Project → same repository.
- Root Directory: `frontend` · Framework Preset: Vite (build `npm run build`, output `dist`)
- Environment: `VITE_API_URL` = backend URL from step 3 + `/api`.
- `vercel.json` sends every route to `index.html`, so meeting links such as `/room/kqz-bmt` work.

**5.** Copy the Vercel URL into `CLIENT_URL` on the Render backend and redeploy it.

> **Render free tier:** a service sleeps after 15 minutes without requests, and the first request after that takes about a minute. Open the backend's `/api/health` and the AI Service's `/` URL a minute before a demo. During a meeting, the captions polling keeps both services awake.
