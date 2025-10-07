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
- Unread message tracking
- Unmatch functionality
- User profile with LLM settings
- Token-based context trimming

### 🔧 Known Issues
- Character names default to "Character" when syncing to backend (cosmetic)
- Swipe undo limited to last action (no full history)

## Planned Enhancements

### High Priority
- [ ] Search/filter in matches page
- [ ] Responsive design refinement (mobile optimization)
- [ ] Better error handling and empty states
- [ ] Loading state improvements

### Medium Priority
- [ ] Advanced filtering (by tags, personality traits)
- [ ] Character import/export functionality
- [ ] Conversation search (search within messages)
- [ ] Message editing/deletion
- [ ] Character favorites/pinning in sidebar

### Low Priority
- [ ] Dark/light theme toggle
- [ ] Voice chat integration (TTS/STT)
- [ ] Image generation for characters
- [ ] Character sharing/recommendations
- [ ] Chat export (download conversation history)
- [ ] Custom character sorting options

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

## Future Ideas (Brainstorm)

### AI Enhancements
- **Model switching per character**: Different models for different characters
- **Memory system**: Long-term character memory across conversations
- **Personality drift**: Character evolves based on conversation history
- **Multiple personas**: One character with different moods/personas

### Social Features
- **Character marketplace**: Share and discover community characters
- **Friend system**: See what characters friends are chatting with
- **Group chats**: Multiple characters in one conversation

### Technical Improvements
- **RAG integration**: Character books with semantic search
- **Streaming responses**: Real-time message streaming
- **Voice cloning**: Unique voice for each character
- **Mobile apps**: Native iOS/Android versions

### Gamification
- **Achievements**: Unlock badges for milestones
- **Character levels**: Characters "level up" through conversation
- **Daily challenges**: Conversation prompts/topics

## Notes
- Built as personal project (single-user focus)
- No production overhead needed (tests, TypeScript, etc.)
- Prioritize features that improve personal UX
- Keep codebase maintainable for solo development
