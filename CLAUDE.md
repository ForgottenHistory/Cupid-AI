# Cupid AI - Technical Context

> Current implementation details and architecture. See PLAN.md for planned features.

## Architecture Overview

**Stack**: React + Vite frontend, Node.js + Express backend, SQLite database
**AI Provider**: OpenRouter (configurable per-user LLM settings)
**Storage**: IndexedDB (frontend) + SQLite (backend)

## Key Implementation Details

### Frontend Structure
- **Main Layout**: `MainLayout.jsx` - Sidebar with matches, unread indicators, nav
- **Core Pages**:
  - `Home.jsx` - Tinder-style swipe interface
  - `Chat.jsx` - Individual chat conversations
  - `Library.jsx` - Character management
  - `Profile.jsx` - User settings and LLM config
- **Services**:
  - `characterService.js` - IndexedDB operations for characters
  - `chatService.js` - Backend API calls for conversations/messages
  - `api.js` - Axios instance with auth token injection

### Backend Structure
- **Routes**: `auth.js`, `users.js`, `characters.js`, `chat.js`
- **Services**: `aiService.js` - OpenRouter integration, system prompts, token counting/trimming
- **Database**: `database.js` - better-sqlite3 with auto-migrations
- **Auth**: JWT tokens, `authenticateToken` middleware

## Important Patterns

### Character Data Flow
1. PNG upload → Parse v2 card → Store in IndexedDB (frontend)
2. Like character → Sync to backend SQLite (user_id + character_id)
3. Dating profile generated on-demand via OpenRouter (cached in cardData)

### Chat System
- Conversations created on first message
- `unread_count` tracks unread messages per conversation
- Messages marked as read when chat is opened
- AI responses use character description + dating profile + system prompt
- Component unmount tracking prevents stale state updates
- **Context window management**: Token-based trimming keeps recent messages, drops old ones
- **Multi-message system**: Newlines split into separate bubbles with 800ms delays
- **Typing indicator**: Text-based "{name} is typing..." with random 500-2000ms delay
- **Message animations**: Slide-up on new messages only (tracked via `newMessageIds` Set)

### Unread Notifications
- Backend increments `unread_count` on AI responses
- `markAsRead` endpoint resets count when user views chat
- `characterUpdated` custom event triggers sidebar refresh
- First messages generated at match time (50/50 chance)

## Critical Bugs Fixed

### Race Condition with Chat Navigation
**Issue**: Sending message in Chat A, navigating to Chat B before response → Chat B shows Chat A's messages
**Fix**: Capture `characterId` at request start, check `isMountedRef.current` before state updates

### Double First Message Generation
**Issue**: First message generated twice due to React strict mode + useEffect
**Fix**: Moved generation to swipe action (Home.jsx), removed from Chat.jsx load

### Unread Count Not Clearing
**Issue**: Messages marked as read even when user navigated away
**Fix**: Added `isMountedRef` to track if user is still viewing that chat

## Database Schema Notes

### Key Tables
- `users` - LLM settings (model, temperature, max_tokens, context_window, etc.)
- `conversations` - Links user + character, tracks `unread_count`, `last_message`
- `messages` - role ('user'|'assistant'), content, timestamps
- `characters` - Synced from IndexedDB, stores full card_data JSON

### Migrations
Auto-run on startup via `database.js`:
- Adds LLM settings columns if missing
- Adds `unread_count` column if missing
- Adds `llm_context_window` column (default 4000 tokens)

## AI System Prompt Rules

Located in `aiService.js` `buildSystemPrompt()`:
- Explicitly forbids roleplay formatting (*actions*, "dialogue")
- Enforces dating app text message style
- Uses character description + scenario + system_prompt fields
- Dating profile injected into character data if available

## Development Commands

```bash
# Frontend
cd frontend && npm run dev  # Port 5173

# Backend
cd backend && npm start     # Port 3000 (nodemon auto-restart)
```

## Known Quirks

- Character names default to "Character" when syncing to backend (cosmetic)
- Dating profile generation uses fixed prompt in `characters.js`
- Image parsing happens client-side, backend only stores metadata
- Swipe undo limited to last action (no full history)
- Match animation doesn't auto-dismiss (user must click)

## Recent Changes

- **Context window system**: Token counting with gpt-tokenizer, smart message trimming
- **Multi-message display**: AI responses split by newlines with progressive 800ms delays
- **Typing indicator**: Changed from animated dots to text-based with random delay
- **Message animations**: Slide-up only on new messages (prevents re-animation on render)
- **Sidebar previews**: Shows last message text instead of "Start chatting..."
- **Chat UI cleanup**: Removed character avatars from message bubbles
- LLM Settings now includes adjustable context window (1K-200K tokens)

## Environment Variables

Backend `.env`:
```
PORT=3000
FRONTEND_URL=http://localhost:5173
JWT_SECRET=<random-secret>
OPENROUTER_API_KEY=<your-key>
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

No frontend env vars needed (API URL hardcoded to localhost:3000).
