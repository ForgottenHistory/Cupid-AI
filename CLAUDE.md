# Cupid AI - Technical Context

**Stack**: React + Vite frontend, Node.js + Express backend, SQLite database, IndexedDB
**AI Providers**: OpenRouter and Featherless (user-configurable)
**External Services**: Stable Diffusion WebUI (image generation)

## CRITICAL: How to Work on This Codebase

### Core Principles
1. **READ CAREFULLY**: When the user gives instructions, read EVERY word. Don't skim. Don't assume. Don't fill in blanks.
2. **LITERAL INTERPRETATION**: If user says "remove the less common stuff", that means REMOVE, not ADD.
3. **ASK WHEN UNCLEAR**: If an instruction is ambiguous, ASK before doing anything. Better to clarify than to waste time.
4. **CHECK YOUR WORK**: Before using tools, mentally verify that what you're about to do matches what was asked.
5. **NO ASSUMPTIONS**: Don't assume you know better. Don't "improve" things that weren't asked to be improved.
6. **FOLLOW THROUGH**: If you start a task, complete it fully. Don't leave things half-done.
7. **CONTEXT MATTERS**: When user says "cut down on all the excess tags", the word "all" and "excess" are key. This is a broad request, not a narrow one.

### Common Failure Patterns to AVOID
- **Opposite Actions**: User says "remove", you add. User says "simplify", you complicate.
- **Scope Creep**: User asks for X, you do X + Y + Z without permission.
- **Selective Reading**: Reading the first few words of an instruction and missing critical qualifiers.
- **Overconfidence**: Assuming you understand without verification.
- **Tunnel Vision**: Focusing on one small detail and missing the bigger picture.
- **Quick Fixes and Hacks**: When something doesn't work, don't patch it with heuristics or workarounds. Fix the root cause.
  - Bad: "Reasoning leaking? Let me strip it with regex patterns"
  - Good: "Reasoning leaking? Use a non-reasoning model instead"
  - Bad: "Tags getting discarded? Let me add 1000 color combinations to the library"
  - Good: "Tags getting discarded? Make validation smarter to handle color+item combos"
- **Band-aids over Architecture**: Don't add code to work around problems. Change the approach.
- **"This should work" mentality**: If you're adding complex logic to fix an edge case, you're probably solving the wrong problem.

### When Making Changes
1. **Read the request 2-3 times** before touching any code
2. **Identify the core verb**: Remove? Add? Change? Simplify? Fix?
3. **Identify the scope**: One file? Multiple files? A system? Everything?
4. **Identify constraints**: "Don't commit", "for now", "just", "all"
5. **Plan the changes** mentally before using tools
6. **Verify alignment**: Does my plan match what was asked?
7. **Execute carefully**: Do exactly what was planned, nothing more

### Git Commits
- **NEVER commit without explicit permission** from the user
- If user says "don't commit without my permission", take that seriously for the ENTIRE SESSION
- Even if changes seem complete, ASK before committing

## Key Implementation Details

### Frontend Structure
- **Main Layout**: `MainLayout.jsx` - Sidebar with matches, unread indicators, nav
- **Core Pages**:
  - `Home.jsx` - Tinder-style swipe interface
  - `Feed.jsx` - Social media feed with full-screen post view
  - `Chat.jsx` - Individual chat conversations
  - `Library.jsx` - Character management with "Character Wizard" button
  - `Profile.jsx` - User settings and LLM config
  - `CharacterWizard.jsx` - 4-step AI character creation wizard
- **Wizard Components** (`components/wizard/`):
  - `WizardProgress.jsx` - Visual progress indicator
  - `IdentityStep.jsx` - Age, archetype, personality trait selection
  - `DescriptionStep.jsx` - LLM name + description generation
  - `ImageStep.jsx` - LLM appearance + SD image generation
  - `OptionsStep.jsx` - Auto-generation options + save
- **Settings Components** (`components/settings/`):
  - `LLMSettingsForm.jsx` - Shared form for Content/Decision/Image Tag LLM settings
  - `ModelSelector.jsx` - Search/filter model dropdown with deduplication
  - `SliderParameter.jsx` - Reusable slider component
  - `AdvancedSettings.jsx` - Collapsible advanced settings section
- **Services**:
  - `characterService.js` - IndexedDB operations for characters
  - `chatService.js` - Backend API calls for conversations/messages
  - `api.js` - Axios instance with auth token injection
- **Hooks**:
  - `useLLMSettings.js` - State management for LLM settings (load, save, update, reset)

### Backend Structure
- **Routes**: `auth.js`, `users.js`, `characters.js`, `chat.js`, `wizard.js`, `feed.js`, `sync.js`, `debug.js`
- **Services**:
  - `aiService.js` - Multi-provider LLM integration (OpenRouter/Featherless), system prompts, token counting/trimming, decision engine, Big Five personality generation, retry logic
  - `queueService.js` - Request queuing to respect API concurrency limits (OpenRouter: 100, Featherless: 1)
  - `compactService.js` - Conversation compacting with AI summarization, block deletion, 5-slot summary cap
  - `messageService.js` - Message operations, block detection (30-min gaps), summary tracking
  - `imageTagGenerationService.js` - Context-aware Danbooru tag generation for character images
  - `characterWizardService.js` - AI character generation (name, description, appearance, image tags), SD integration
  - `engagementService.js` - Character state tracking, time-based engagement durations, cooldown system
  - `proactiveMessageService.js` - Background service for proactive messaging (checks every 5 minutes)
  - `postGenerationService.js` - Background service for character posts (checks every 60 minutes, 10 posts/day limit)
  - `superLikeService.js` - Super like probability calculation, daily limit tracking (2 per day)
  - `sdService.js` - Stable Diffusion image generation with retry logic
  - `ttsService.js` - ChatterBox TTS voice generation with retry logic
- **Utils**: `logger.js` - File logging with console intercept, 10-minute rolling cleanup (runs every 60s)
- **Database**: `database.js` - better-sqlite3 with auto-migrations
- **Auth**: JWT tokens, `authenticateToken` middleware

## Important Patterns

### Character Data Flow

**Imported Characters**:
1. PNG upload → Parse v2 card → Store in IndexedDB (frontend)
2. Like character → Sync to backend SQLite (user_id + character_id)
3. Dating profile generated on-demand via OpenRouter (cached in cardData)

**Wizard-Generated Characters**:
1. Complete 4-step wizard → LLM generates name/description, appearance, SD generates image
2. Create in IndexedDB via `createCharacter()` with minimal v2 card (name, description, imageTags)
3. Optional auto-generation on save (dating profile, schedule, Big Five personality)
4. Like character → Sync to backend SQLite with imageTags from cardData

### Chat System
**Core Functionality**:
- Conversations created on first message, `unread_count` tracking, mark as read
- Component unmount tracking prevents stale state updates
- Context window management with token-based trimming
- Multi-message display (newlines → separate bubbles, 800ms delays)
- Typing indicator, message animations, editing/deletion, regenerate

**AI Integration**:
- Triple LLM system (Content generates responses, Decision makes behavioral choices, Image Tag for pictures)
- Schedule-based status (online/away/busy/offline) affects engagement
- Time-based engagement durations with natural departures
- Proactive messaging (characters message first after time gaps)
- Reaction system (rare emoji reactions on emotional messages)
- AI reply suggestions (serious/sarcastic/flirty)
- Super likes (extraversion-based, 2/day limit, guaranteed first message)
- Character unmatch (rare, for inappropriate behavior)

### Unread Notifications
- Backend increments `unread_count` on AI responses
- `markAsRead` endpoint resets count when user views chat
- `characterUpdated` custom event triggers sidebar refresh
- First messages generated at match time (50/50 chance if online, 100% on super like)

## Database Schema Notes

### Key Tables
- `users` - Three independent LLM configurations (Content, Decision, Image Tag), proactive message tracking, super like tracking
- `conversations` - Links user + character, tracks `unread_count`, `last_message`
- `messages` - role ('user'|'assistant'), content, timestamps, reaction (emoji or null)
- `characters` - Synced from IndexedDB, stores full card_data JSON, image_url, schedule_data, personality_data, is_super_like
- `character_states` - Per user-character engagement tracking (status, engagement_state, engagement_started_at, departed_status, last_check_time)
- `posts` - Character-generated social media posts (character_id, content, image_url, post_type, created_at)

### Migrations
Auto-run on startup via `database.js`:
- Content LLM settings (provider, model, temperature, max_tokens, context_window, etc.)
- Decision LLM settings (separate configuration with lower defaults)
- Image Tag LLM settings (third independent configuration for Danbooru tag generation)
- Conversation tracking (`unread_count`, reactions, schedule data, personality data)
- Engagement system (`character_states` table, engagement tracking columns)
- Proactive messaging and super like tracking

## AI System

### Triple LLM Architecture
Three independent LLM configurations with separate provider/model/parameter settings:

**Content LLM** - Generates character responses
- Uses full character prompt with dating app style enforcement
- Token-based context window management
- Located in `aiService.js` `createChatCompletion()`

**Decision LLM** - Makes behavioral decisions
- Analyzes conversation context for reactions, unmatch decisions
- Lower temperature/tokens than Content LLM
- Located in `aiService.js` `makeDecision()`

**Image Tag LLM** - Generates Danbooru tags
- Context-aware image tag generation for character images
- Separate configuration for speed (typically OpenRouter)
- Located in `imageTagGenerationService.js`

**Multi-Provider Support**:
- OpenRouter and Featherless supported with independent configuration per LLM
- Dynamic model loading from provider APIs
- Provider-specific parameters (Featherless: repetition_penalty, top_k, min_p)
- Request queuing via `queueService.js` to respect concurrency limits (OpenRouter: 100, Featherless: 1)

### Message Flow & Prompt Structure
**Prompt Construction** (`aiService.js` lines 91-165):
1. System prompt with character description + dating profile
2. Older messages (beyond last 5)
3. Time/status/schedule context
4. **Critical roleplay reminder**: "RESUME ROLEPLAY NOW - write something ENTIRELY NEW, don't copy old messages"
5. **Last 5 messages** (maximum recency bias)
6. Character name prime

**System Prompt Rules**:
- Explicitly forbids roleplay formatting (*actions*, "dialogue")
- Enforces dating app text message style
- Dating profile injected if available
- Departure context added when engagement duration expires

**Message Processing Flow**:
1. User message → Check schedule status (online/away/busy/offline)
2. Check cooldown → if waiting for status change, no response
3. If disengaged: 70% chance to engage, 30% no response
4. Fast response delay (~1 second)
5. Check engagement duration → set `isDeparting` flag if expired
6. Decision LLM → reaction emoji, unmatch decision
7. Content LLM → generates response (with departure context if flagged)
8. Response saved → WebSocket delivery

### Time-Based Engagement System
`engagementService.js` - Characters stay engaged for realistic durations:
- **Online**: Unlimited engagement
- **Away**: 30-60 minutes → natural departure
- **Busy**: 15-30 minutes → natural departure
- **Offline**: No response
- Cooldown after departure until status changes
- 70% engagement probability when disengaged

### Proactive Messaging System
`proactiveMessageService.js` - Characters send first messages after time gaps:
- Checks every 5 minutes, triggers when online + last message from user + gap > 1 hour
- Send probability: 5% per hour (capped 50%), modified by extraversion (-25% to +25%)
- Daily limit: 5 proactive messages per user
- Decision LLM chooses message type: resume/fresh/callback
- Content LLM receives time gap + message type for natural generation

### Big Five Personality System
`aiService.js` - OCEAN personality traits (0-100) generated from character description:
- Extraversion affects proactive messaging frequency
- Stored in database + IndexedDB
- UI: Personality tab in Library with gradient progress bars

### Retry Logic
All AI generation services have exponential backoff retry system:
- **Retries**: 3 attempts with delays: 1s → 2s → 4s
- **Retryable errors**: 429 (rate limit), 500-504 (server errors), ECONNRESET, ETIMEDOUT, ECONNREFUSED
- **Timeout**: 120 seconds per request
- **Applied to**: LLM completions (chat and basic), SD image generation, TTS voice generation
- Located in `aiService.js`, `sdService.js`, `ttsService.js`

### Conversation Compacting
Automatic summarization to prevent context window overflow:
- **Triggers**: Before each AI response in `messageProcessor.js`
- **Settings**: Percentage-based (scale with context window changes)
  - Threshold: 90% of context window (when to start compacting)
  - Target: 70% of context window (when to stop compacting)
  - Keep uncompacted: Last 30 messages always protected
- **Block detection**: 30-minute gaps between messages define conversation blocks
- **Processing**:
  - Small blocks (< 15 messages): Deleted without summary
  - Large blocks (≥ 15 messages): Replaced with AI-generated summary
  - Max 5 summary slots (oldest deleted when creating 6th)
- **Summaries**: Generated by Decision LLM from character's first-person perspective
- **Debug tools**: `testCompact()` and `showBlockStructure()` in browser console (exposed via `debugCompact.js`)

## Character Wizard

AI-powered 4-step character creation. Alternative to importing character cards.

**4-Step Flow**:
1. **Identity**: Age, archetype, 3-5 personality traits (weighted randomize button)
2. **Description**: LLM generates name + detailed description (editable)
3. **Image**: LLM appearance generation + SD profile picture (base tags stored, enhancements one-time)
4. **Options**: Optional auto-generation checkboxes (dating profile, schedule, Big Five), save

**Backend** (`characterWizardService.js`): Name/description/appearance generation, SD orchestration
**Frontend**: 4 step components, plain text data files (`archetypes.txt`, `personalityTraits.txt`)
**Storage**: IndexedDB via `createCharacter()`, syncs to backend SQLite on like

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

**Latest Updates**:
- **Retry logic**: Exponential backoff (3 retries: 1s, 2s, 4s) for all AI services, handles unreliable providers
- **Conversation compacting**: Percentage-based auto-summarization to prevent context overflow, scales with context window
- **Debug tools**: `testCompact()` and `showBlockStructure()` for testing compacting behavior in browser console
- **Image Tag LLM** (third independent LLM configuration for Danbooru tag generation with separate provider/model settings)
- **Queue system** (`queueService.js` prevents concurrency limit errors, OpenRouter: 100, Featherless: 1)
- **Prompt restructuring** (last 5 messages placed before character prime for maximum recency bias)

**Core Features**:
- **Triple LLM system**: Content, Decision, Image Tag (independent provider/model/parameter configs)
- **Conversation compacting**: Automatic AI summarization with 5-slot cap, 30-min gap block detection
- **Social media feed**: Full-screen posts, 60min generation cycle, 10/day cap, personality-driven frequency
- **Character Wizard**: 4-step AI character creation, LLM generation + SD images
- **Proactive messaging**: Time-gap detection, extraversion-based probability, 5/day limit, escalating cooldowns
- **Big Five personality**: OCEAN traits affect proactive frequency
- **Time-based engagement**: Status-based durations (online unlimited, away 30-60min, busy 15-30min)
- **AI reply suggestions**: Three-button UI (serious/sarcastic/flirty)
- **Super likes**: Extraversion-based probability (0-10%), 2/day limit, guaranteed first message
- **Character unmatch**: Rare AI decision for inappropriate behavior
- **Schedule system**: LLM-generated weekly schedules, real-time status
- **Reaction system**: Emoji reactions on emotionally significant messages (rare)
- **Image generation**: SD WebUI integration, context-aware decisions (`IMAGE_MESSAGES_ENABLED=true`)
- **Voice messages**: ChatterBox TTS integration (`VOICE_MESSAGES_ENABLED=false`, disabled)

## Environment Variables

Backend `.env`:
```
PORT=3000
FRONTEND_URL=http://localhost:5173
JWT_SECRET=<random-secret>
OPENROUTER_API_KEY=<your-key>
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
FEATHERLESS_API_KEY=<your-key>  # Optional: Only needed if using Featherless provider
TTS_SERVER_URL=http://localhost:5000
SD_SERVER_URL=http://127.0.0.1:7860
VOICE_MESSAGES_ENABLED=false
IMAGE_MESSAGES_ENABLED=true
```

No frontend env vars needed (API URL hardcoded to localhost:3000).
