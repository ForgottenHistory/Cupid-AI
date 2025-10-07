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
- [ ] **Dual LLM System (Decision Engine + Content Generator)**
  - Small LLM makes behavioral decisions, large LLM generates content
  - Second set of LLM settings in Profile (Decision Engine tab)
  - Character state tracking system (moods, events, relationship dynamics)
  - **Phase 1**: Reaction system (character can REACT to messages with emoji/action)
  - **Phase 2**: Drama engine (random events, mood changes, proactive messages)
  - **Phase 3**: Advanced orchestration (topic routing, escalation gates)

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

### Character State Variables
Stored in new `character_states` table (per user-character pair):
- **current_mood**: happy, stressed, flirty, vulnerable, distant, excited, tired
- **energy_level**: 0-100 (affects response enthusiasm)
- **trust_level**: 0-100 (gates vulnerable content)
- **attraction_level**: 0-100 (affects flirtiness)
- **tension_meter**: 0-100 (drama engine builds/releases tension)
- **current_event**: null, "bad_day", "exciting_news", "feeling_lonely", "conflict_active"
- **secrets_revealed**: JSON array of unlocked backstory elements
- **topics_discussed**: JSON array of conversation topics covered

### Decision Engine Actions
- **REACT**: Character reacts to user message with emoji/short action (❤️, 😂, 🤔, etc.)
- **MOOD_SHIFT**: Change character's current mood based on conversation
- **PROACTIVE_MESSAGE**: Decide to send unsolicited message after time gap

### Implementation Flow
1. User sends message
2. Decision LLM analyzes context + character state → outputs action(s)
3. Content LLM generates actual response text with state-informed system prompt
4. Backend updates character state based on decision output
5. Frontend displays message + any reactions/effects

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
