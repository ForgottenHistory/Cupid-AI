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

### 🔧 Known Issues
- Character names default to "Character" when syncing to backend (cosmetic)
- Swipe undo limited to last action (no full history)

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

### Phase 2: Schedule & Engagement System 🚧 PLANNED

#### Character Status System
Four status levels that affect availability:
- **Online**: Available, responds quickly (30sec-2min first response)
- **Away**: Doing something, slower responses (5-20min first response)
- **Busy**: Work/important task, very slow responses (15-60min first response)
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

#### Engagement Window System
Realistic conversation flow instead of flat delays:

**1. Initial Response Delay**
- Message sits unread based on character's current status
- Eventually character "checks phone" and responds
- Probability of checking increases over time

**2. Engagement Window** (2-5 messages)
- Once character responds, they're "engaged" for a short burst
- Fast back-and-forth responses (30sec-2min delays)
- Feels like real active conversation

**3. Disengagement**
- After engagement window expires:
  - 50% chance of closing message ("gotta run!", "back to work")
  - 50% chance of just stopping (goes back to unread state)
- Returns to scheduled status behavior

**Example Flow:**
```
10:00 AM - User: "How's your day going?"
          [Character is busy at work, message unread]

10:45 AM - Char: "Hey! Pretty hectic, but good 😊"
          [Engagement window: 3 messages remaining]

10:46 AM - User: "What are you working on?"
10:47 AM - Char: "Just finishing up a big presentation"
          [2 messages remaining]

10:48 AM - User: "Nice! How'd it go?"
10:48 AM - Char: "Went well! But gotta get back to it, talk later?"
          [Engagement ends, back to busy]

11:00 AM - User: "Sure thing!"
          [No response until next check/window]
```

#### Database Schema
**characters table**:
- `schedule_data` JSON - Weekly schedule with status blocks
- `schedule_generated_at` TIMESTAMP - When schedule was generated

**character_states table** (per user-character pair):
- `current_status` TEXT - Current calculated status (online/away/busy/offline)
- `engagement_state` TEXT - engaged/disengaged
- `engagement_messages_remaining` INTEGER - Messages left in current window
- `last_check_time` TIMESTAMP - Last time character "checked phone"
- `message_queue` JSON - Messages waiting for character to come online

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

### Phase 3: Drama Engine 🔮 FUTURE
- Random events that affect character mood/availability
- Mood shifts based on conversation content
- Proactive messages after long gaps
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

## Notes
- Built as personal project (single-user focus)
- No production overhead needed (tests, TypeScript, etc.)
- Prioritize features that improve personal UX
- Keep codebase maintainable for solo development
