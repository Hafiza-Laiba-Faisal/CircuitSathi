# CircuitSathi

CircuitSathi is an AI-powered STEM learning platform that turns electronic circuit schematics into an interactive visual experience. It combines a drag-and-drop circuit editor, real-time simulation, AI tutoring, and voice narration into one learning environment.

## What it does

- Edit circuit schematics with a visual component palette
- Resize and arrange workspace panels for better learning flow
- Run circuit simulation and inspect component behavior
- Generate AI-guided tutorials from a topic or uploaded lab manual
- Convert tutor commentary into speech using ElevenLabs
- Save and reload circuit projects via backend storage

## Architecture

This repository is a monorepo with two main services:

- `frontend/` — Next.js 14 app with React, Tailwind CSS, Zustand, React Flow, PixiJS
- `backend/` — Express + TypeScript API with MongoDB support and AI integration
- `shared/` — Shared TypeScript types used by both frontend and backend

## Key Features

- Responsive workspace layout with top, right, and bottom tutor panels
- Right-panel width controls and drag-to-resize support
- AI tutorial generation from typed topics or uploaded manuals
- File upload parsing for PDF, DOCX, or raw text lab manuals
- Project saving/loading via REST API
- Audio narration support for lesson content

## Quick Setup

### Prerequisites

- Node.js 18+
- npm 9+
- MongoDB connection string (Atlas or local)

### Install and run frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs by default on `http://localhost:3000`.

### Install and run backend

```bash
cd backend
npm install
cp .env.example .env
# update .env with MongoDB and API keys
npm run dev
```

Backend runs by default on `http://localhost:3001`.

## Backend environment variables

Create `backend/.env` with values for:

- `PORT` — backend port (default: `3001`)
- `MONGODB_URI` — MongoDB connection string
- `GEMINI_API_KEY` — optional Gemini API key for AI logic
- `ELEVENLABS_API_KEY` — ElevenLabs TTS API key

## Backend API Endpoints

| Method | Endpoint             | Description |
|--------|----------------------|-------------|
| GET    | `/api/health`        | Health check |
| GET    | `/api/projects`      | List saved projects |
| POST   | `/api/projects`      | Save or update a project |
| GET    | `/api/projects/:id`  | Load a saved project |
| DELETE | `/api/projects/:id`  | Delete a saved project |
| POST   | `/api/simulate`      | Run circuit simulation |
| POST   | `/api/upload`        | Parse uploaded circuit file |
| POST   | `/api/narrate`       | Generate TTS audio from text |
| POST   | `/api/tutor/parse`   | Generate AI tutorial from manual/topic |

## Development notes

- Frontend state is managed with `zustand` and shared types from `shared/types.ts`
- The system uses `reactflow` for schematic editing and `pixi.js` for animation
- The backend accepts manual uploads with `multer` and parses PDF/DOCX using `pdf-parse` / `mammoth`
- Tutor generation uses a multi-phase AI flow with structured JSON fallback

## Folder structure

```text
CircuitSathi/
├── backend/          # Express API, AI routes, project persistence
├── frontend/         # Next.js app, editor UI, tutor panels, simulation view
├── shared/           # Shared TypeScript types
└── README.md         # This file
```

## Helpful commands

```bash
# start frontend
cd frontend && npm run dev

# start backend
cd backend && npm run dev

# build frontend
cd frontend && npm run build

# build backend
cd backend && npm run build
```

## Notes

- The app supports both interactive tutorial mode and manual schematic editing.
- Right-side tutor layout is resizable and bottom tutor mode scrolls internally.
- The tutor engine can handle Urdu/Roman Urdu topics and returns structured tutorial steps.
