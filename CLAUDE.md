# Cupid AI - Technical Context

> Current implementation details and architecture. See PLAN.md for planned features.

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

## Architecture Overview

**Stack**: React + Vite frontend, Node.js + Express backend, SQLite database
**AI Provider**: OpenRouter (configurable per-user LLM settings)
**Storage**: IndexedDB (frontend) + SQLite (backend)

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
- **Feed Components**:
  - `PostCard.jsx` - Post display (deprecated, replaced by full-screen view)
- **Wizard Components** (`components/wizard/`):
  - `WizardProgress.jsx` - Visual progress indicator
  - `IdentityStep.jsx` - Age, archetype, personality trait selection
  - `DescriptionStep.jsx` - LLM name + description generation
  - `ImageStep.jsx` - LLM appearance + SD image generation
  - `OptionsStep.jsx` - Auto-generation options + save
- **Settings Components** (`components/settings/`):
  - `LLMSettingsForm.jsx` - Shared form for Content/Decision LLM settings
  - `ModelSelector.jsx` - Search/filter model dropdown
  - `SliderParameter.jsx` - Reusable slider component
  - `AdvancedSettings.jsx` - Collapsible advanced settings section
- **Services**:
  - `characterService.js` - IndexedDB operations for characters
  - `chatService.js` - Backend API calls for conversations/messages
  - `api.js` - Axios instance with auth token injection
- **Hooks**:
  - `useLLMSettings.js` - State management for LLM settings (load, save, update, reset)

### Backend Structure
- **Routes**: `auth.js`, `users.js`, `characters.js`, `chat.js`, `wizard.js`, `feed.js`, `sync.js`
- **Services**:
  - `aiService.js` - OpenRouter integration, system prompts, token counting/trimming, decision engine, Big Five personality generation
  - `characterWizardService.js` - AI character generation (name, description, appearance, image tags), SD integration
  - `engagementService.js` - Character state tracking, time-based engagement durations, cooldown system
  - `proactiveMessageService.js` - Background service for proactive messaging (checks every 5 minutes)
  - `postGenerationService.js` - Background service for character posts (checks every 60 minutes, 10 posts/day limit)
  - `superLikeService.js` - Super like probability calculation, daily limit tracking (2 per day)
- **Utils**: `logger.js` - File logging with console intercept (auto-clears on restart)
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
- Conversations created on first message
- `unread_count` tracks unread messages per conversation
- Messages marked as read when chat is opened
- AI responses use character description + dating profile + system prompt
- Component unmount tracking prevents stale state updates
- **Context window management**: Token-based trimming keeps recent messages, drops old ones
- **Multi-message system**: Newlines split into separate bubbles with 800ms delays
- **Typing indicator**: Text-based "{name} is typing..." with random 500-2000ms delay
- **Message animations**: Slide-up on new messages only (tracked via `newMessageIds` Set)
- **Dual LLM system**: Decision LLM makes behavioral decisions (reactions), Content LLM generates responses
- **Reaction system**: Emoji reactions appear rarely (1 in 5 messages) on emotionally significant user messages
- **Message editing/deletion**: Users can edit or delete messages, delete-from removes message + all after it
- **Regenerate**: Users can regenerate the last AI response
- **Schedule system**: Characters have weekly schedules (online/away/busy/offline) generated by LLM
- **Status display**: Chat header shows real-time status with colored badges and activity text
- **Time-based engagement**: Characters stay engaged for realistic durations based on status, then depart naturally
- **AI reply suggestions**: Three-button UI generates suggested user replies (serious, sarcastic, flirty styles)
- **Proactive messaging**: Characters can send messages first after time gaps (only when online, context-aware)
- **Big Five personality**: OCEAN model personality traits generated per character, affects proactive messaging frequency
- **Super likes**: Characters can super like users (extraversion-based probability 0-10%, 2/day limit, online only, guaranteed first message)

### Unread Notifications
- Backend increments `unread_count` on AI responses
- `markAsRead` endpoint resets count when user views chat
- `characterUpdated` custom event triggers sidebar refresh
- First messages generated at match time (50/50 chance if online, 100% on super like)

## Database Schema Notes

### Key Tables
- `users` - LLM settings (model, temperature, max_tokens, context_window, etc.) + Decision LLM settings + proactive message tracking + super like tracking
- `conversations` - Links user + character, tracks `unread_count`, `last_message`
- `messages` - role ('user'|'assistant'), content, timestamps, reaction (emoji or null)
- `characters` - Synced from IndexedDB, stores full card_data JSON, image_url, schedule_data, schedule_generated_at, personality_data, is_super_like
- `character_states` - Per user-character engagement tracking (status, engagement_state, engagement_started_at, departed_status, last_check_time)
- `posts` - Character-generated social media posts (character_id, content, image_url, post_type, created_at)

### Migrations
Auto-run on startup via `database.js`:
- Adds LLM settings columns if missing
- Adds `unread_count` column if missing
- Adds `llm_context_window` column (default 4000 tokens)
- Adds Decision LLM settings columns (model, temperature, max_tokens, context_window with lower defaults)
- Adds `reaction` column to messages table
- Adds `schedule_data` and `schedule_generated_at` columns to characters table
- Creates `character_states` table for engagement tracking
- Adds `engagement_started_at` and `departed_status` columns to character_states table
- Adds `personality_data` column to characters table (stores Big Five traits)
- Adds `proactive_messages_today` and `last_proactive_date` columns to users table
- Adds `super_likes_today` and `last_super_like_date` columns to users table
- Adds `is_super_like` column to characters table

## AI System

### Dual LLM Architecture
- **Decision Engine** (small LLM): Analyzes conversation context and makes behavioral decisions
  - Determines if character should react with emoji (rare, 1 in 5 messages or less)
  - Decides if character should unmatch (extremely rare, only for inappropriate behavior)
  - Returns: `{ reaction: "emoji"|null, shouldRespond: boolean, shouldUnmatch: boolean }`
  - Engagement duration handled programmatically by time-based system
  - Uses separate user-configurable settings (lower temperature, fewer tokens)
  - Located in `aiService.js` `makeDecision()`
- **Content Generator** (large LLM): Creates actual character responses
  - Uses full character prompt with dating app style enforcement
  - Token-based context window management
  - Located in `aiService.js` `createChatCompletion()`

### Content LLM System Prompt Rules
Located in `aiService.js` `buildSystemPrompt()`:
- Explicitly forbids roleplay formatting (*actions*, "dialogue")
- Enforces dating app text message style
- Uses character description + scenario + system_prompt fields
- Dating profile injected into character data if available
- When `isDeparting` flag is true, prompts for natural departure message using schedule context

### Message Flow
1. User sends message → saved to DB
2. Check character's schedule → determine current status (online/away/busy/offline)
3. Check if character is on cooldown (waiting for status change) → if yes, no response
4. If status changed from departed status → clear cooldown
5. If disengaged: 70% chance to engage and respond, 30% no response
6. Apply fast response delay (~1 second with variance)
7. Check if engagement duration expired → if yes, set `isDeparting` flag
8. Decision LLM analyzes context → decides reaction and unmatch
9. **If unmatch decision**: Character deleted from backend, conversation removed, unmatch modal shown
10. Content LLM generates response (with departure context if flagged)
11. If departing → mark character as departed, start cooldown until status changes
12. Response saved with reaction → displayed with reaction badge on user's message

### Time-Based Engagement System
Located in `engagementService.js`:
- **Response delays**: All responses ~0.5-2 seconds (fast, realistic texting speed)
- **Engagement durations** (characters stay engaged for realistic time periods):
  - **Online**: Unlimited (stays engaged as long as conversation flows)
  - **Away**: 30-60 minutes → then sends natural departure message
  - **Busy**: 15-30 minutes → then sends natural departure message
  - **Offline**: No response
- **Departure behavior**: When duration expires, Content LLM generates natural "gtg" message using schedule context
- **Cooldown system**: After departing, character won't respond until schedule status changes
- **70% engagement probability**: On first message when disengaged (30% chance of no response)
- **State tracking**: `character_states` table tracks `engagement_started_at`, `departed_status` per user-character pair

### Proactive Messaging System
Located in `proactiveMessageService.js`:
- **Background checker**: Runs every 5 minutes via setInterval in `server.js`
- **Triggers**: Only when character status = online, last message from user, gap > 1 hour
- **Send probability**: Base 5% per hour (capped at 50%), modified by extraversion trait
  - High extraversion (80-100) increases probability by up to +25%
  - Low extraversion (0-20) decreases probability by up to -25%
- **Daily limit**: Maximum 5 proactive messages per day across all characters
- **Decision Engine (proactive mode)**: Analyzes conversation context + time gap
  - Decides: `{ shouldSend: boolean, messageType: "resume"|"fresh"|"callback" }`
  - **Resume**: Continue previous topic naturally
  - **Fresh**: Start new conversation
  - **Callback**: Reference something interesting from earlier
- **Content LLM generation**: Receives `gapHours`, `isProactive`, and `proactiveType` in system prompt
  - Time-aware guidance: <3hrs (immediate), 3-12hrs (earlier today), 12-24hrs (most of a day), 24+hrs (yesterday)
  - Directive phrasing: "You want to CONTINUE..." / "You want to START SOMETHING NEW..."
  - Natural message generation based on both type AND time gap
- **Delivery**: Messages sent via WebSocket with `isProactive: true` flag

### Big Five Personality System
Located in `aiService.js` `generatePersonality()`:
- **Model**: OCEAN (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism)
- **Generation**: Small LLM analyzes character description → rates each trait 0-100
- **Storage**: Stored in `personality_data` column (characters table) and `personalityTraits` field (IndexedDB cardData)
- **Usage**: Extraversion affects proactive messaging frequency
- **Future potential**: Can inform mood changes, dialogue style, reaction patterns
- **UI**: Personality tab in Library with gradient progress bars for visual representation

## Character Wizard

AI-powered 4-step character creation system. Alternative to importing character cards.

### Architecture

**Backend** (`characterWizardService.js`):
- `generateDescription()`: LLM generates full name + detailed character description from age/archetype/personality traits
- `generateAppearance()`: LLM suggests cohesive appearance (hair, eyes, body, clothing style) matching personality
- `generateImageTags()`: Content LLM creates personality-driven Danbooru tags for dating profile picture
- `buildImageTags()`: Converts appearance selections to base Danbooru tags (stored long-term)
- `generateImage()`: Orchestrates SD generation - uses enhanced tags for image, stores only base tags

**Frontend Components**:
- `CharacterWizard.jsx`: Main orchestrator with 4-step flow, save logic, auto-generation
- `WizardProgress.jsx`: Visual progress indicator
- `IdentityStep.jsx`: Age (weighted random: 50% 18-25, 30% 26-35, 15% 36-45, 5% 46+), archetype, 3-5 personality traits
- `DescriptionStep.jsx`: LLM generates name + description, user can edit
- `ImageStep.jsx`: LLM appearance generation, SD profile picture with personality enhancements
- `OptionsStep.jsx`: Optional auto-generation checkboxes (dating profile, schedule, Big Five), save button

**Data Files** (plain text, one value per line):
- `archetypes.txt`: College Student, Career Professional, Creative Artist, Gym Enthusiast, etc.
- `personalityTraits.txt`: Sweet, Confident, Playful, Mysterious, Shy, Sarcastic, etc.

### Wizard Flow

**Stage 1: Identity**
- Select age range, archetype, 3-5 personality traits
- Randomize button with weighted age distribution
- No name input (generated in Stage 2)

**Stage 2: Description**
- Click "Generate Character" → LLM creates name + 2-3 paragraph description
- Name format: Full name (first + last) or nickname, female characters only
- Description covers: background, occupation, personality, interests, communication style
- User can edit both name and description

**Stage 3: Image**
- "Generate Appearance" button: LLM suggests cohesive appearance matching personality
- Manual override: Dropdowns for hair color/style, eye color, body type, clothing style
- "Generate Character Image":
  - LLM creates enhanced Danbooru tags (base appearance + expression + pose + setting + lighting)
  - SD generates dating profile picture with personality (smiling, looking at viewer, warm lighting, etc.)
  - Only base appearance tags stored to `imageTags` field (enhancements are one-time)

**Stage 4: Options & Save**
- Checkboxes for optional auto-generation on save:
  - Dating Profile: LLM-generated profile summary
  - Weekly Schedule: LLM-generated online/away/busy/offline schedule
  - Big Five Personality: OCEAN trait ratings (0-100)
- All optional (can save without checking any)
- Click "Save Character" → creates in IndexedDB, auto-generates selected features, redirects to Library

### API Endpoints

- `POST /api/wizard/generate-description`: Generate name + description from age/archetype/traits
- `POST /api/wizard/generate-appearance`: LLM suggests cohesive appearance
- `POST /api/wizard/generate-image`: SD generation with LLM-enhanced tags

### Character Storage

**IndexedDB (wizard-generated)**:
- Created via `characterService.createCharacter()` (not `importCharacterFromPNG`)
- Character v2 card structure with minimal fields (name, description, tags, imageTags)
- Auto-generated features stored in `cardData.data` (datingProfile, schedule, personalityTraits)

**Backend Sync**:
- Character synced to SQLite when liked (swiped right)
- `image_tags` column populated from `cardData.data.imageTags`
- `characterInteractionController.js` extracts and stores imageTags on like

### LLMSettings Refactor

Broke 489-line monolithic component into modular structure:

**Hook**:
- `useLLMSettings.js`: State management (load, save, update, reset) for Content/Decision LLM settings

**Components**:
- `SliderParameter.jsx`: Reusable slider with label, value, description, custom labels
- `AdvancedSettings.jsx`: Collapsible section for top_p, frequency_penalty, presence_penalty
- `ModelSelector.jsx`: Search/filter dropdown for model selection
- `LLMSettingsForm.jsx`: Shared form used by both Content and Decision tabs

**Main Component**:
- `LLMSettings.jsx`: Reduced to ~106 lines, tab management, delegates to LLMSettingsForm

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

- **Social Media Feed System** ✅
  - Full-screen single-post view (like Instagram Stories) instead of traditional feed
  - Large character avatar on left (320px wide, full height), content on right
  - Navigation: Arrow buttons + keyboard arrows (← →) with swoosh animation
  - Character posts generated every 60 minutes by background service
  - 10 posts per day cap distributed by personality (high extraversion = more posts)
  - LLM generates post content (1-3 sentences, social media style)
  - Posts only when character is online/away (not offline/busy)
  - Click avatar/name to navigate to DM with character
  - Post counter in header (e.g., "3 / 8")
  - **All characters post**, not just matched ones - automatic sync on app load
  - Database: `posts` table (character_id, content, image_url, post_type, created_at)
  - Backend: `postGenerationService.js`, `routes/feed.js`, `routes/sync.js` with `/sync/characters` endpoint
  - Frontend: `Feed.jsx` with full-screen view, smooth slide transitions, auto-sync in `MainLayout`
  - Character images synced from IndexedDB to backend (`image_url` column)
  - Sync preserves existing character data (schedule, personality, etc.)
- **Character Wizard** ✅
  - AI-powered 4-step character creation as alternative to importing character cards
  - Stage 1: Select age (weighted randomize), archetype, personality traits
  - Stage 2: LLM generates full name + detailed description from traits
  - Stage 3: LLM appearance generation matching personality, SD profile picture with enhancements
  - Stage 4: Optional auto-generation checkboxes (dating profile, schedule, Big Five)
  - Backend: `characterWizardService.js`, routes `/generate-description`, `/generate-appearance`, `/generate-image`
  - Frontend: `CharacterWizard.jsx` with 4 step components, plain text data files (`archetypes.txt`, `personalityTraits.txt`)
  - Enhanced SD tags (expression, pose, lighting) for one-time profile pic, base tags stored long-term
  - LLMSettings refactored: 489-line component broken into reusable hooks/components (106 lines main)
  - `createCharacter()` method for wizard characters, `ImageTab` fallback to IndexedDB for unsynced characters
  - Library page updated with prominent "Character Wizard" button
- **Proactive messaging improvements** ✅
  - Content LLM now receives `gapHours` for time-aware message generation
  - Time-specific guidance: 2-hour gap feels different from 20-hour gap
  - Directive prompts: "You want to CONTINUE..." vs. "You want to START SOMETHING NEW..."
  - Better natural message phrasing based on both type (resume/fresh/callback) AND elapsed time
- **Sidebar status bug fix** ✅
  - Fixed status indicator color mismatch between sidebar and chat view
  - Removed engagement-based override that showed green (online) when character was actually busy/away
  - Status colors now accurately reflect character's schedule status in both sidebar and chat
- **Proactive messaging system** ✅
  - Characters can send messages first after time gaps (only when online)
  - Background service checks every 5 minutes for proactive opportunities
  - Context-aware Decision Engine analyzes conversation → decides if/how to respond
  - Three message types: resume conversation, fresh start, callback to earlier topic
  - Send probability scales with time gap (5% per hour, cap 50%) and extraversion trait
  - Daily limit: 5 proactive messages across all characters
  - Messages delivered via WebSocket with special flag for frontend handling
- **Big Five personality traits** ✅
  - OCEAN model personality generation (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism)
  - LLM analyzes character description → rates each trait 0-100
  - Personality tab in Library with beautiful gradient progress bars
  - Extraversion trait affects proactive messaging frequency
  - Stored in both IndexedDB (frontend) and SQLite (backend)
  - Foundation for future features (mood changes, dialogue style, reaction patterns)
- **Time-based engagement overhaul** ✅
  - Replaced arbitrary message-count disengagement with realistic time-based durations
  - Online: unlimited engagement, Away: 30-60min, Busy: 15-30min
  - Natural departure messages generated by Content LLM using schedule context
  - Cooldown system blocks responses until character's status changes
  - Simplified all response delays to ~1 second (removed status-based delays)
  - Removed `continueEngagement` from Decision LLM (now handled programmatically)
  - Characters stay engaged during good conversations instead of dropping out arbitrarily
- **AI reply suggestions** ✅
  - Three-button UI in chat input: Serious, Sarcastic, Flirty
  - Generates suggested user replies based on conversation context
  - Uses separate API endpoint: `/api/chat/conversations/:characterId/suggest-reply`
  - Helps users craft better responses in different tones
- **Super like system** ✅
  - Characters can super like users with personality-based probability (extraversion 0-100 → 0-10% chance)
  - Daily limit: 2 super likes per day per user
  - Only triggers when character is online
  - Guaranteed first message on super like (vs 50% on regular match)
  - Special AI prompt showing extra enthusiasm
  - SuperLikeModal with blue gradient, sparkles, bouncing heart animation
  - Debug function: `debugSuperLike()` in browser console
- **Character-initiated unmatch** ✅
  - Decision Engine can decide to unmatch (extremely rare, only for inappropriate user behavior)
  - Character deleted from backend, conversation removed, user notified via WebSocket
  - Animated unmatch modal (similar to match modal but with broken hearts and red theme)
  - Modal shows character name, grayscale image, and "Back to Home" button
  - Debug function `debugUnmatch()` available in browser console for testing
  - Located in: `messageProcessor.js` (backend), `UnmatchModal.jsx` (frontend), `useChatWebSocket.js` (WebSocket handler)
- **Phase 2: Schedule & Engagement System** ✅
  - LLM-generated weekly schedules (online/away/busy/offline status blocks)
  - Real-time status calculation from schedule + current time
  - Status display in chat header with colored badges
  - Engagement window system: Initial delays based on status, then 2-5 message bursts with fast responses (5-15s)
  - character_states table tracks engagement per user-character pair
  - 70% engagement probability on first message when disengaged
  - Schedule generation UI in character profile Library
  - Plaintext schedule format (more reliable than JSON, fewer tokens)
- **Dual LLM system**: Decision engine + content generator architecture
  - Small LLM makes behavioral decisions (reactions, mood changes, engagement, unmatch)
  - Large LLM generates character responses
  - Separate configurable settings for each in Profile (tabs: Content LLM / Decision LLM)
- **Reaction system**: Emoji reactions overlay on user messages
  - Rare (1 in 5 messages or less), only on emotionally significant messages
  - Positioned absolutely on user message bubbles (-bottom-2, -right-2)
  - Stored in messages table, displayed via lookahead (check next message)
- **Voice messaging system** ✅ (DISABLED)
  - ChatterBox TTS server integration (separate Python service on port 5000)
  - Voice Library: Upload/manage voice samples (WAV/MP3/OGG/FLAC → 24kHz mono WAV)
  - Character voice assignment in Image tab
  - Decision Engine decides when to send voice vs text
  - Web Audio API player with phone-quality effects (muffled, intimate)
  - Database: `voice_id` (characters), `message_type`/`audio_url` (messages)
  - Feature flag: `VOICE_MESSAGES_ENABLED=false` (disabled, audio effects need tuning)
- **Image generation system** ✅
  - Stable Diffusion WebUI integration (port 7860) with Highres fix + ADetailer
  - Character image tags (Danbooru format) configured in Image tab
  - Decision Engine decides when to send images + generates contextual tags
  - Final prompt: `base + character tags + context tags` (e.g., "masterpiece, best quality, amazing quality, 1girl, solo, blue hair, red eyes, smiling, park, daytime")
  - Context-aware decisions: user asks for photo → YES, flirty moments → consider, random → NO
  - Content LLM informed of media decision to write appropriate accompanying text
  - Database: `image_tags` (characters), `image_url` (messages)
  - Images saved to `/uploads/images/`, displayed in chat (click to open full size)
  - Debug function: `debugGenerateImage(contextTags)` in browser console
  - Feature flag: `IMAGE_MESSAGES_ENABLED=true`
- **File logging**: All console output logged to `backend/logs/server.log`
  - Auto-clears on server restart
  - Intercepts console.log/error/warn at startup
  - Clean output (removed SQL spam, excessive response details)
- **Message editing/deletion**: Edit message content, delete message + all after it
- **Regenerate responses**: Generate new AI response for current conversation state
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
TTS_SERVER_URL=http://localhost:5000
SD_SERVER_URL=http://127.0.0.1:7860
VOICE_MESSAGES_ENABLED=false
IMAGE_MESSAGES_ENABLED=true
```

No frontend env vars needed (API URL hardcoded to localhost:3000).
