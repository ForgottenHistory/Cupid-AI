# AI-Dater - Planning Document

## Overview
A Tinder-style app for discovering and matching with AI character cards (Character v2 format). Swipe through characters, like your favorites, chat with AI personalities, and manage your collection.

## Tech Stack

### Frontend
- **Framework**: React + Tailwind CSS + Vite
- **Storage**: IndexedDB (character data)
- **Routing**: React Router
- **Character Format**: Character v2 Cards (.png with embedded JSON)
- **Font**: Inter (Google Fonts)

### Backend
- **Runtime**: Node.js + Express
- **Database**: SQLite with better-sqlite3
- **Authentication**: JWT + bcrypt
- **AI Integration**: OpenRouter API
- **Token Management**: gpt-tokenizer for context window trimming

## Current Status

### ✅ Completed Features
- Authentication (JWT, login/signup)
- Character upload & parsing (PNG v2 cards)
- Swipe interface with undo
- Character profiles with AI-generated dating profiles
- AI-generated weekly schedules from character descriptions
- Matches collection
- AI chat with context window management
- Multi-message display (split by newlines)
- Typing indicator with random delays
- Message animations (slide-up)
- Message deletion, editing
- AI message regeneration
- Unread message tracking
- Unmatch functionality
- User profile with LLM settings
- Token-based context trimming
- Dual LLM System (Phase 1: Reactions, Phase 2: Schedules & Engagement)
- Time-based engagement system (realistic durations with natural departures)
- Character status system (online/away/busy/offline)
- Real-time status display in chat
- Cooldown system (blocks responses until status changes)
- AI reply suggestions (serious, sarcastic, flirty tones)
- Proactive messaging system (characters send messages first)
- Big Five personality traits (OCEAN model with visual UI)

### 🔧 Known Issues
- Character names default to "Character" when syncing to backend (cosmetic)
- Swipe undo limited to last action (no full history)

### 🔨 Recently Fixed
- ✅ Sidebar status color mismatch - status indicators now match between sidebar and chat view
- ✅ Proactive messages now time-aware - Content LLM receives gap hours for natural phrasing

## Planned Enhancements

### High Priority
- [x] **Dual LLM System (Decision Engine + Content Generator)** ✅ Phase 1 Complete
  - Small LLM makes behavioral decisions, large LLM generates content
  - Second set of LLM settings in Profile (Decision Engine tab)
  - Character state tracking system (moods, events, relationship dynamics)
  - **Phase 1**: ✅ Reaction system (character can REACT to messages with emoji/action)
  - **Phase 2**: Schedule & Engagement system (realistic availability, engagement windows)
  - **Phase 3**: Drama engine (random events, mood changes, proactive messages)
  - **Phase 4**: Advanced orchestration (topic routing, escalation gates)

### Medium Priority
- [ ] Advanced filtering (by tags, personality traits)
- [ ] Character import/export functionality
- [ ] Conversation search (search within messages)
- [ ] Character favorites/pinning in sidebar
- [ ] Search/filter in matches page
- [ ] Responsive design refinement (mobile optimization)
- [ ] Better error handling and empty states
- [ ] Loading state improvements

### Low Priority
- [ ] Dark/light theme toggle
- [ ] Voice chat integration (TTS/STT)
- [ ] Image generation for characters
- [ ] Chat export (download conversation history)

## Character v2 Card Format Reference
```javascript
{
  spec: "chara_card_v2",
  data: {
    name: string,
    description: string,
    personality: string,
    scenario: string,
    first_mes: string,
    mes_example: string,
    creator_notes: string,
    system_prompt: string,
    post_history_instructions: string,
    alternate_greetings: string[],
    character_book: object,
    tags: string[],
    creator: string,
    character_version: string,
    extensions: object
  }
}
```

## Dual LLM System - Technical Details

### Phase 1: Reaction System ✅ IMPLEMENTED
- Decision LLM analyzes user messages and decides on emoji reactions
- Reactions appear rarely (1 in 5 messages) on emotionally significant messages
- Stored in messages table, displayed as badge overlay on user messages
- Separate LLM settings for decision engine (lower temp, fewer tokens)

### Phase 2: Schedule & Engagement System ✅ IMPLEMENTED

#### Character Status System
Four status levels that affect engagement duration and availability:
- **Online**: Available, stays engaged indefinitely during good conversations
- **Away**: Doing something, stays engaged for 30-60 minutes then departs
- **Busy**: Work/important task, stays engaged for 15-30 minutes then departs
- **Offline**: Sleeping/unavailable, no responses until back online

#### Weekly Schedule Structure
Stored as JSON in `characters` table `schedule_data` column:
```json
{
  "schedule": {
    "monday": [
      {"start": "08:00", "end": "17:00", "status": "busy", "activity": "Work"},
      {"start": "17:00", "end": "19:00", "status": "online"},
      {"start": "19:00", "end": "21:00", "status": "away", "activity": "Gym"},
      {"start": "21:00", "end": "23:00", "status": "online"},
      {"start": "23:00", "end": "08:00", "status": "offline", "activity": "Sleep"}
    ],
    // ... tuesday-sunday
  },
  "responseDelays": {
    "online": [30, 120],      // seconds
    "away": [300, 1200],      // 5-20min
    "busy": [900, 3600],      // 15-60min
    "offline": null
  }
}
```

#### Time-Based Engagement System
Realistic conversation flow based on time durations:

**1. Initial Response**
- When disengaged: 70% chance to engage and respond, 30% no response
- Fast response delay (~1 second) for all responses
- No more status-based long delays

**2. Engagement Duration**
- Once engaged, character stays engaged for a duration based on their status:
  - **Online**: Unlimited (stays in conversation)
  - **Away**: 30-60 minutes
  - **Busy**: 15-30 minutes
- Timer starts when engagement begins

**3. Natural Departure**
- When duration expires, character sends natural departure message:
  - Content LLM generates "gtg" message using schedule context
  - Examples: "gotta get back to work", "friends are here, ttyl!"
- Character enters cooldown state

**4. Cooldown Period**
- After departing, character won't respond until their status changes
- Status change clears cooldown, character can engage again

**Example Flow:**
```
10:00 AM - User: "How's your day going?"
          [Character is away, disengaged]

10:00 AM - Char: "Hey! Pretty hectic, but good 😊"
          [Engaged, 45min duration (away status)]

10:01 AM - User: "What are you working on?"
10:01 AM - Char: "Just finishing up a big presentation"

10:02 AM - User: "Nice! How's it going?"
10:02 AM - Char: "Going well! Almost done"

... conversation continues naturally ...

10:45 AM - User: "That's awesome!"
10:45 AM - Char: "Thanks! Gotta get back to it, talk later?"
          [Duration expired, natural departure]
          [Now on cooldown until status changes from "away"]

11:00 AM - User: "Sure thing!"
          [No response - on cooldown]
```

#### Database Schema
**characters table**:
- `schedule_data` JSON - Weekly schedule with status blocks
- `schedule_generated_at` TIMESTAMP - When schedule was generated

**character_states table** (per user-character pair):
- `current_status` TEXT - Current calculated status (online/away/busy/offline)
- `engagement_state` TEXT - engaged/disengaged
- `engagement_started_at` TIMESTAMP - When current engagement began (for duration tracking)
- `departed_status` TEXT - Status when character departed (for cooldown until status changes)
- `last_check_time` TIMESTAMP - Last state update time

#### Implementation Steps
1. **Schedule Generation** (Library UI)
   - "Generate Schedule" button on character cards
   - LLM generates realistic weekly schedule based on character description
   - User can preview/edit before saving
   - Stored when character is liked/matched

2. **Status Calculation** (Backend)
   - `GET /api/characters/:id/status` - Calculate current status from schedule + time
   - Returns: `{ status, activity, nextStatusChange, lastSeen }`

3. **Engagement Logic** (Decision Engine)
   - Check engagement state before responding
   - If engaged → respond quickly, decrement counter, decide on disengagement
   - If not engaged → decide if character "checks phone" (time-based probability)
   - If checking phone → start new engagement window (2-5 messages)

4. **Frontend Display** (Chat UI)
   - Status badge in chat header (colored dot + text)
   - Activity text if present ("At work", "At the gym")
   - "Last seen X minutes ago" for offline characters
   - Typing indicator delay matches engagement state

5. **Message Queueing** (Backend)
   - Messages sent while character is offline → added to queue
   - When character comes online → process queue with engagement logic
   - Decision engine can decide to respond to multiple queued messages at once

#### Implementation Notes (Phase 2)
**Completed Features:**
- ✅ Database schema: Added `schedule_data` and `schedule_generated_at` columns to characters table
- ✅ Database schema: Created `character_states` table with `engagement_started_at` and `departed_status` columns
- ✅ Backend service: Created `engagementService.js` for state management and time-based engagement tracking
- ✅ Schedule generation: LLM generates plaintext schedules, parsed into JSON
- ✅ Status calculation: Real-time status from schedule + current time
- ✅ Time-based engagement: Online (unlimited), Away (30-60min), Busy (15-30min)
- ✅ Natural departures: Content LLM generates contextual "gtg" messages when duration expires
- ✅ Cooldown system: Characters blocked from responding until status changes after departure
- ✅ Fast response delays: All responses ~0.5-2 seconds (no more status-based delays)
- ✅ Frontend UI: Schedule tab in character profile with generation button
- ✅ Frontend UI: Status display in chat header with colored badges
- ✅ Frontend UI: AI reply suggestion buttons (serious, sarcastic, flirty)

**Technical Details:**
- Plaintext schedule format preferred over JSON (more reliable, fewer tokens)
- 70% engagement probability on first message when disengaged, 30% no response
- Engagement duration tracked programmatically, not by Decision LLM
- Departure messages generated by Content LLM with `isDeparting` flag
- Cooldown cleared automatically when character's status changes
- Status colors: green (online), yellow (away), red (busy), gray (offline)
- AI suggestions use conversation context to generate tone-specific user replies

### Proactive Messaging System ✅ IMPLEMENTED
**Overview**: Characters can send messages first after time gaps, making conversations feel more natural and alive.

**Background Service**:
- Runs every 5 minutes via `setInterval` in `server.js`
- Checks all conversations where last message was from user
- Only considers characters with status = online
- Minimum time gap: 1 hour

**Send Probability Calculation**:
- Base probability: 5% per hour of gap time (capped at 50%)
- Personality modifier: Extraversion trait affects frequency
  - High extraversion (80-100): +25% modifier
  - Low extraversion (0-20): -25% modifier
  - Medium extraversion (40-60): neutral
- Example: After 5 hours with 80 extraversion → 50% (capped) + 20% = 70% chance

**Daily Limits**:
- Maximum 5 proactive messages per day per user
- Counter resets at midnight (tracked in `users` table)
- Global limit prevents spam across all characters

**Decision Engine (Proactive Mode)**:
- Analyzes last 5 messages for conversation context + time gap
- Decides: `{ shouldSend: boolean, messageType: "resume"|"fresh"|"callback" }`
- **Resume**: Continue previous topic if conversation was mid-flow
- **Fresh**: Start new conversation if topic naturally ended
- **Callback**: Reference something interesting from earlier

**Content Generation**:
- Receives `gapHours`, `isProactive`, and `proactiveType` in system prompt
- Time-aware guidance based on gap duration:
  - <3 hours: "keep it casual and immediate, like you just thought of it"
  - 3-12 hours: "you can reference 'earlier' or 'this morning/afternoon'"
  - 12-24 hours: "it's been most of a day - acknowledge the time gap naturally"
  - 24+ hours: "you can reference 'yesterday' or the time gap if natural"
- Directive phrasing: "You want to CONTINUE..." / "You want to START SOMETHING NEW..."
- Natural message generation based on both type AND elapsed time
- No apologies for not responding (character is reaching out!)

**Database Tracking**:
- `users` table: `proactive_messages_today`, `last_proactive_date`
- Automatic daily reset logic

### Big Five Personality System ✅ IMPLEMENTED
**Model**: OCEAN (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism)

**Generation**:
- Small LLM (DeepSeek Chat v3) analyzes character description + personality field
- Rates each trait 0-100 on psychological scales
- Stores in both `personality_data` column (backend) and `personalityTraits` (IndexedDB)

**Traits**:
1. **Openness** (0-100): Curiosity, creativity, openness to new experiences
2. **Conscientiousness** (0-100): Organization, dependability, discipline
3. **Extraversion** (0-100): Sociability, assertiveness, energy around others
4. **Agreeableness** (0-100): Compassion, cooperation, trust in others
5. **Neuroticism** (0-100): Emotional sensitivity vs. stability

**Current Usage**:
- Extraversion affects proactive messaging frequency
- Foundation for future behavioral modeling

**Future Potential**:
- Openness → willingness to try new topics/activities
- Conscientiousness → schedule adherence, message timing
- Agreeableness → conflict handling, compromise
- Neuroticism → mood swings, emotional reactions

**UI**:
- Personality tab in Library (CharacterProfile component)
- Gradient progress bars with color coding
- One-click generation from character description

### Character Wizard - PLANNED
**Overview**: AI-powered character generator that creates unique characters from scratch instead of importing existing cards. Uses LLM + Stable Diffusion to generate complete Character v2 cards.

**Purpose**:
- Generate fresh, unique characters with AI
- Alternative to importing existing character cards
- Creates complete characters with description, image, schedule, personality, dating profile

**Character Structure** (Simplified):
Cupid-AI only uses **name** and **description** from Character v2 spec:
- `name` - Character name
- `description` - Detailed character description (backstory, traits, likes/dislikes, behavior)
  - **Note**: This is backend-only, used for AI behavior/prompting - user never sees this
- Everything else (schedule, dating profile, Big Five) auto-generated from description

**Extensibility via JSON Files**:
```
frontend/src/data/
├── archetypes.json          # Character archetypes (easily add more)
└── personalityTraits.json   # Personality tags (easily add more)
```

**archetypes.json** example:
```json
[
  {
    "id": "college_student",
    "name": "College Student",
    "description": "Young, energetic, balancing studies and social life"
  },
  {
    "id": "career_professional",
    "name": "Career Professional",
    "description": "Ambitious, goal-oriented, work-life balance"
  }
]
```

**personalityTraits.json** example:
```json
[
  { "id": "sweet", "name": "Sweet" },
  { "id": "confident", "name": "Confident" },
  { "id": "playful", "name": "Playful" }
]
```

---

#### Wizard Flow (3 Stages)

**Stage 1: Character Identity**
User defines core identity:
- **Name** (text input)
- **Age** (dropdown: 18-25, 26-35, 36-45, 46+)
- **Archetype** (load from `archetypes.json`)
  - Display as grid of selectable cards
  - Examples: College Student, Career Professional, Creative Artist, Gym Enthusiast, Bookworm, Gamer, etc.
- **Personality Tags** (load from `personalityTraits.json`)
  - Grid of selectable buttons
  - Select 3-5 traits (e.g., Sweet, Confident, Playful, Mysterious, Shy, Sarcastic)

**Stage 2: Generate Description**
LLM generates character description:
1. User clicks **"Generate Character"** button
2. Backend LLM call with prompt:
   ```
   "Create a detailed character description for a dating app AI character:
   - Name: [name]
   - Age: [age]
   - Archetype: [archetype description]
   - Personality: [trait1, trait2, trait3]

   Write 2-3 paragraphs covering:
   - Background and occupation
   - Personality traits and behavior
   - Interests, hobbies, likes/dislikes
   - Communication style

   This description will be used to guide the AI's behavior in conversations."
   ```
3. Display generated description in **editable textarea**
4. **"Regenerate"** button if user wants different description
5. **Auto-generate** supporting data:
   - Dating profile (existing system)
   - Weekly schedule (existing system)
   - Big Five personality (existing system)

**Stage 3: Generate Image & Save**
Generate character image and save:

**Appearance Selection**:
- Hair color (dropdown: Blonde, Brunette, Black, Red, etc.)
- Hair style (dropdown: Long Straight, Wavy, Bob Cut, Ponytail, etc.)
- Eye color (dropdown: Brown, Blue, Green, Hazel, etc.)
- Body type (dropdown: Petite, Slim, Athletic, Curvy, Plus Size)
- Style (dropdown: Casual, Elegant, Sporty, Gothic, Cute, Professional)

**Image Generation**:
1. Click **"Generate Image"** button
2. Build Danbooru tags from appearance selections
   - Example: `1girl, solo, blonde hair, long hair, blue eyes, athletic, casual clothing`
3. Call Stable Diffusion WebUI (existing integration):
   - Uses user's SD settings (Highres fix, ADetailer, etc.)
   - Generation takes ~20-30 seconds
   - Shows loading spinner + progress
4. Display generated image
5. **"Regenerate Image"** button if not satisfied

**Save Character**:
1. Click **"Save Character"** button
2. Create Character v2 card JSON:
   ```json
   {
     "spec": "chara_card_v2",
     "data": {
       "name": "Emily",
       "description": "[LLM-generated description]",
       "tags": ["generated", "wizard"]
     }
   }
   ```
3. Embed JSON metadata into PNG image
4. Save to IndexedDB (frontend storage)
5. Auto-generate supporting data:
   - Dating profile
   - Weekly schedule
   - Big Five personality
6. Redirect to Library page

---

#### Technical Implementation

**Frontend Structure**:
```
frontend/src/
├── data/
│   ├── archetypes.json (NEW)
│   └── personalityTraits.json (NEW)
├── pages/
│   └── CharacterWizard.jsx (NEW - main wizard component)
├── components/wizard/
│   ├── WizardProgress.jsx (NEW - progress bar)
│   ├── IdentityStep.jsx (NEW - Stage 1)
│   ├── DescriptionStep.jsx (NEW - Stage 2: LLM generation)
│   └── ImageStep.jsx (NEW - Stage 3: SD + save)
```

**Backend Endpoints**:
```javascript
POST /api/characters/wizard/generate-description
// Input: { name, age, archetype, personalityTags }
// Output: { description }

POST /api/characters/wizard/generate-image
// Input: { appearance: { hair, eyes, body, style } }
// Output: { imageUrl, imageTags }

POST /api/characters/wizard/create
// Input: { name, description, imageBlob, imageTags }
// Output: { characterId, character }
```

**Backend Services**:
- `characterWizardService.js` (NEW):
  - `generateDescription(name, age, archetype, traits)` → LLM call
  - `generateImageTags(appearance)` → Build Danbooru tags
  - `generateImage(tags)` → Call SD WebUI
  - `createCharacterCard(name, description, image)` → Build v2 card + embed PNG
- Reuse existing services:
  - `aiService.js` - LLM calls for description generation
  - `scheduleService.js` - Generate weekly schedule
  - `personalityService.js` - Generate Big Five traits
  - `characterService.js` - Dating profile generation

**Data Flow**:
```
Stage 1: User Input
  → Store: { name, age, archetype, personalityTags }

Stage 2: LLM Generation
  → API: /wizard/generate-description
  → Backend: Content LLM generates description
  → Store: { ...stage1, description }

Stage 3: Image + Save
  → User selects appearance
  → API: /wizard/generate-image (SD WebUI)
  → API: /wizard/create (save to DB)
  → Auto-generate: schedule, dating profile, personality
  → Save to IndexedDB as Character v2 card
  → Redirect to Library
```

---

#### UI/UX Details

**Progress Bar**:
- 3-step indicator: Identity → Description → Image
- Shows current stage with icon + color
- Progress fills as stages complete

**Navigation**:
- **Previous** button (disabled on Stage 1)
- **Next** button (Stage 1 → Stage 2)
- **Generate Character** button (Stage 2)
- **Generate Image** button (Stage 3)
- **Save Character** button (final action)
- **Cancel** button (all stages) → discard and return to Library

**Validation**:
- Stage 1: Name required, archetype required, 3+ personality tags
- Stage 2: Description generated (not empty)
- Stage 3: Image generated (not null)

**Error Handling**:
- LLM generation fails → show error, allow retry
- SD generation fails → show error, allow retry
- Save fails → show error, keep data in wizard state

---

#### Benefits

✅ **Extensible**: Add archetypes/traits via JSON files (no code changes)
✅ **Simple**: 3 stages, only name + description needed
✅ **Integrated**: Auto-generates schedule, dating profile, Big Five personality
✅ **Reuses systems**: Existing LLM, SD, personality, schedule generation
✅ **Unique characters**: LLM creates varied descriptions from same inputs
✅ **User-friendly**: Guided wizard flow with regeneration options

#### Future Enhancements
- Import archetype/trait presets from community
- Save/load partial wizard progress
- Character templates (save wizard config for reuse)
- Bulk generation (create multiple characters at once)
- Advanced customization (system_prompt, scenario, etc.)

### Voice Messaging System 🎙️ ✅ COMPLETE
**Overview**: Characters can send voice messages instead of text, adding personality and immersion through voice cloning.

**Architecture**:
- **TTS Server**: Separate Python FastAPI server running ChatterBox TTS (port 5000)
- **Voice Library**: User-uploaded voice samples stored and managed
- **Decision Engine**: Decides between text or voice message
- **Node.js Proxy**: Backend proxies TTS requests and serves audio files

**ChatterBox TTS Server** (`tts-server/`):
- FastAPI server with ChatterBox TTS model
- Voice upload/conversion (converts to 24kHz mono WAV)
- TTS generation with voice cloning
- Runs independently on port 5000
- GPU-accelerated (CUDA/ROCm) or CPU fallback

**Voice Library System**:
```
Frontend (React):
- Voice Library page/modal for managing voices
- Upload voice samples (WAV/MP3/OGG/FLAC)
- Assign voices to characters
- Audio preview/playback

Backend (Node.js):
- Voice CRUD endpoints (list, upload, delete)
- Proxy upload to ChatterBox server
- Link voices to characters (voice_id)
- Serve generated audio files

ChatterBox Server (Python):
- POST /upload-voice - Process and store voice samples
- POST /generate - Generate TTS with voice cloning
- GET /voices - List available voices
- DELETE /voices/{name} - Remove voice
```

**Decision Engine Integration**:
```javascript
// Decision LLM prompt addition
{
  shouldRespond: boolean,
  shouldSendVoice: boolean,  // NEW: decide voice vs text
  reaction: "emoji" | null,
  continueEngagement: boolean,
  shouldUnmatch: boolean
}
```

**Decision Logic**:
- Character personality affects voice frequency
  - Extraversion: Higher = more voice messages
  - Openness: Higher = more experimental with format
- Conversation context affects decision
  - Emotional moments → more likely voice
  - Quick replies → text
  - Long messages → voice
- Random variation (not every message should be voice)

**Database Schema**:
```sql
-- Add to characters table
ALTER TABLE characters ADD COLUMN voice_id TEXT;

-- Add to messages table
ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'text'; -- 'text' or 'voice'
ALTER TABLE messages ADD COLUMN audio_url TEXT;
```

**Message Flow (Voice)**:
```
1. User sends text message
2. Decision Engine decides: shouldSendVoice = true
3. Content LLM generates text response
4. Backend sends text to ChatterBox TTS server
   POST /api/tts/generate
   { text, voice_name: character.voice_id }
5. ChatterBox generates audio, returns .wav file
6. Backend saves audio file to /uploads/audio/
7. Message saved with:
   - message_type: 'voice'
   - content: [text transcript]
   - audio_url: '/uploads/audio/{messageId}.wav'
8. WebSocket sends message to frontend
9. Frontend displays audio player instead of text bubble
```

**Frontend Components**:
```
VoiceLibrary.jsx:
- Upload voice samples
- Preview/delete voices
- Assign to characters

AudioMessageBubble.jsx:
- Audio player with waveform
- Play/pause controls
- Duration display
- Transcript toggle (show/hide text)

CharacterProfile.jsx:
- Voice selection dropdown
- "Test Voice" button (preview TTS)
```

**Implementation Steps**:
1. ✅ ChatterBox TTS server setup (separate Python service)
2. ✅ Backend voice library endpoints (CRUD operations)
3. ✅ Backend TTS proxy endpoint (forward to ChatterBox)
4. ✅ Database migrations (voice_id, message_type, audio_url)
5. ✅ Decision engine voice decision logic
6. ✅ Message processor voice generation
7. ✅ Frontend voice library UI
8. ✅ Frontend audio message bubbles
9. ✅ Character voice assignment UI

**Technical Notes**:
- Voice samples: 10+ seconds recommended for quality cloning
- Audio format: WAV files (24kHz, mono)
- File storage: `/uploads/audio/` for generated messages
- Caching: Consider caching common phrases per character
- Fallback: If TTS fails, send text message instead
- Performance: ~20 seconds generation time per message

**Future Enhancements**:
- Voice message transcription (STT for user audio)
- Emotion control in voice (ChatterBox exaggeration parameter)
- Voice mixing (blend multiple voice samples)
- Real-time voice generation (streaming audio)

### Phase 3: Drama Engine 🔮 FUTURE
- Random events that affect character mood/availability
- Mood shifts based on conversation content
- Tension/conflict system

### Phase 4: Advanced Orchestration 🔮 FUTURE
- Topic routing (different prompts for different subjects)
- Escalation gates (trust/attraction thresholds)
- Long-term memory and relationship progression

### Character State Variables (Future)
Stored in `character_states` table (per user-character pair):
- **current_mood**: happy, stressed, flirty, vulnerable, distant, excited, tired
- **energy_level**: 0-100 (affects response enthusiasm)
- **trust_level**: 0-100 (gates vulnerable content)
- **attraction_level**: 0-100 (affects flirtiness)
- **tension_meter**: 0-100 (drama engine builds/releases tension)
- **current_event**: null, "bad_day", "exciting_news", "feeling_lonely", "conflict_active"
- **secrets_revealed**: JSON array of unlocked backstory elements
- **topics_discussed**: JSON array of conversation topics covered

## Future Ideas (Brainstorm)

### AI Enhancements
- **Model switching per character**: Different models for different characters
- **Memory system**: Long-term character memory across conversations
- **Personality drift**: Character evolves based on conversation history
- **Multiple personas**: One character with different moods/personas

### Technical Improvements
- **RAG integration**: Character books with semantic search
- **Voice cloning**: Unique voice for each character

### Engagement & Character Rotation
- **Weekly rotation system**: Help surface neglected characters
  - At start of each week, system randomly selects 5 characters to be "active"
  - Only active characters can proactively message or super like user that week
  - Forces engagement with different characters instead of always talking to favorites
  - Could show in sidebar who's "active this week" with special badge
  - Prevents roster bloat where some characters never get used
  - Alternative: attention-based weighting (neglected characters get 3x proactive message priority)

## Notes
- Built as personal project (single-user focus)
- No production overhead needed (tests, TypeScript, etc.)
- Prioritize features that improve personal UX
- Keep codebase maintainable for solo development
