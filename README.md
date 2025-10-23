# Cupid AI

AI-powered dating app simulator. Swipe on characters, match, chat, and build relationships with AI personalities.

## Core Features

**Character Management:**
- Import PNG character cards (v2 spec)
- Character Wizard: AI-generated characters (name, description, appearance, image)
- Dating profiles, weekly schedules, Big Five personality traits
- Daily swipe limits

**Chat System:**
- Triple LLM architecture (Content, Decision, Image Tag)
- Proactive messaging: characters reach out first after time gaps
- Schedule-based engagement: realistic online/away/busy/offline patterns
- Left-on-read follow-ups
- Message pagination (200 messages per page)
- Conversation compacting: automatic summarization when context fills

**AI Features:**
- Multi-provider support (OpenRouter, Featherless)
- Context-aware image generation (Stable Diffusion)
- Mood effects: dynamic backgrounds based on conversation tone
- AI reply suggestions (serious/sarcastic/flirty)
- Message reactions, editing, regeneration
- Character unmatch system

## Tech Stack

**Frontend:**
- React + Vite
- Tailwind CSS
- IndexedDB (character storage)
- Socket.IO (real-time updates)

**Backend:**
- Node.js + Express
- SQLite (better-sqlite3)
- JWT authentication
- Socket.IO
- OpenRouter & Featherless API support

**AI/Image:**
- LLM: OpenRouter, Featherless
- Image: Stable Diffusion WebUI

## Setup

### Prerequisites
- Node.js 18+
- OpenRouter API key (required)
- Featherless API key (optional)
- Stable Diffusion WebUI (optional, for image generation)

### Installation

1. Clone repository
2. Install dependencies:
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. Configure environment:

Create `backend/.env`:
```env
PORT=3000
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your-random-secret-here

# Required
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Optional: Featherless provider
FEATHERLESS_API_KEY=your-featherless-key

# Optional: Image generation
SD_SERVER_URL=http://127.0.0.1:7860
IMAGE_MESSAGES_ENABLED=true

# Disabled features
VOICE_MESSAGES_ENABLED=false
TTS_SERVER_URL=http://localhost:5000
```

4. Start servers:
```bash
# Backend (port 3000)
cd backend
npm start

# Frontend (port 5173)
cd frontend
npm run dev
```

5. Open http://localhost:5173

## Usage

1. **Register/Login**: Create account
2. **Library**: Import character cards or use Character Wizard
3. **Home**: Swipe on characters (right = like, left = pass)
4. **Chat**: Talk with matches, view schedules, generate images
5. **Feed**: Browse character posts
6. **Profile**: Configure LLM settings (Content/Decision/Image Tag), behavior, SD settings

## Configuration

### LLM Settings (per user)
- **Content LLM**: Generates character responses
- **Decision LLM**: Makes behavioral decisions (reactions, moods, unmatch)
- **Image Tag LLM**: Generates Danbooru tags for images

Each has independent provider and model configuration.

### Behavior Settings
- Proactive messaging
- Conversation compacting

### SD Settings
- Sampling parameters
- High-res upscaling
- ADetailer face fixing
- Custom prompts

## Project Structure

```
cupid-ai/
├── backend/
│   ├── src/
│   │   ├── db/              # SQLite database, migrations
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic, AI, queue system
│   │   ├── middleware/      # Auth
│   │   └── utils/           # Helpers, logger
│   ├── logs/                # Auto-cleaning logs (10-min rolling)
│   └── uploads/             # Generated images
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── pages/           # Route pages
│   │   ├── hooks/           # React hooks
│   │   ├── services/        # API, IndexedDB, WebSocket
│   │   ├── context/         # Auth, Mood contexts
│   │   └── utils/           # Helpers
│   └── public/              # Static assets
├── CLAUDE.md                # Technical documentation
├── FILE_REGISTRY.md         # File documentation
└── IDEAS.md                 # Feature ideas
```

## Development

- Backend auto-restarts on changes (nodemon)
- Frontend hot-reload (Vite)
- Logs: `backend/logs/` (server, prompts, responses)
- Database: `backend/cupid.db` (SQLite)

## License

MIT
