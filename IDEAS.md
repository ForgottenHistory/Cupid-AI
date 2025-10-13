# Cupid AI - Feature Ideas & Roadmap

> Potential features and improvements for the Cupid AI dating sim platform

---

## Core Dating Experience

### Voice & Video
- **Voice calls**: Real-time voice conversations with characters (not just voice messages)
- **Video calls**: Simulated video call interface with character portraits and expressions

### Relationship Dynamics
- **Character moods**: Dynamic mood changes based on conversation history, time of day, or events
- **Relationship progression**: Milestones, anniversaries, relationship status tracking (casual, serious, exclusive, etc.)
- **Date planning**: Characters suggest/plan virtual dates with mini-games or scenarios
- **Gift system**: Send virtual gifts that characters react to and remember

---

## Character Depth

### Memory & Context
- **Memory system**: Characters remember specific details you've told them (current occupation, favorite food, past conversations)
- **Character journal**: View relationship timeline, important moments, inside jokes
- **Character arc/growth**: Characters evolve over time based on your interactions
- **Backstory reveals**: Unlock deeper backstory elements as relationship develops

### Social World
- **Friend groups**: Characters mention their friends, creating a wider social world
- **Multiple characters interacting**: Group chats where multiple characters can talk to each other and you

---

## Social Features

### Discovery & Sharing
- **Character recommendations**: "You might also like..." based on personalities you've matched with
- **Share moments**: Export/share funny or memorable conversations (privacy-aware)
- **Leaderboards**: Most messages sent, longest streak, etc. (optional, gamification)

### User Profiles
- **Enhanced user profiles**: More detailed bio, interests, preferences that characters can reference
- **User preferences**: Preferred conversation topics, boundaries, content filters

---

## Content Generation

### Media Expansion
- **Story mode**: Characters send you serialized story content over time
- **Photo albums**: AI-generated photo sets (beach trip, night out, etc.)
- **Character vlogs**: Short text "vlogs" characters post about their day
- **Seasonal events**: Holiday-themed content, special outfits, event-specific dialogue

---

## UX/Polish

### Conversation Management
- **Message reactions**: You can react to character messages with emojis
- **Search conversations**: Find specific messages or topics discussed
- **Conversation topics**: Suggested conversation starters when chat goes quiet
- **Conversation bookmarks**: Mark important messages for later reference

### Character Management
- **Character comparison**: Side-by-side comparison of character traits when deciding who to swipe
- **Import from other sources**: Import characters from CharacterHub, JanitorAI, etc.
- **Character creator improvements**: More detailed wizard, appearance preview, voice preview
- **Character card editing**: Edit character descriptions, traits, and settings after import
- **Block/hide system**: Hide characters without deleting them

---

## Technical Features

### Advanced Functionality
- **Message scheduling**: Schedule messages to be sent at specific times
- **Notification preferences**: Per-character notification settings
- **Conversation export**: Export full conversation history as PDF/JSON
- **Multiple LLM profiles**: Switch between different LLM settings for different moods/contexts
- **RAG for character knowledge**: Characters can have knowledge bases (books, websites, lore documents)
- **Multi-language support**: Characters can speak different languages

### Data Management
- **Backup/restore**: Export and import IndexedDB data for safety
- **Cloud sync**: Optional cloud backup of characters and conversations
- **Character notes**: Write personal notes about characters (private, not visible to AI)

---

## Currently Missing (Higher Priority)

These features feel more like "missing pieces" than "nice-to-haves":

1. **Message search/filtering** - Can't find old messages easily
2. **Character notes** - Can't write personal notes about characters
3. **Conversation bookmarks** - Can't mark important messages
4. **Character card editing** - Can't edit character descriptions after import
5. **Backup/restore** - No way to backup IndexedDB data
6. **Block/hide system** - No way to hide characters without deleting them

---

## Top Priority Recommendations

If prioritizing for maximum impact:

### Tier 1 (Critical)
1. **Memory system** - Make conversations feel continuous and real
2. **Character card editing** - Essential for tweaking imported characters
3. **Backup/restore** - Critical for user data safety

### Tier 2 (High Impact)
4. **Message reactions** - Quick acknowledgment without typing
5. **Character notes/journal** - Track relationship details manually
6. **Search conversations** - Find old messages and topics
7. **Conversation bookmarks** - Mark important moments

### Tier 3 (Polish & Enhancement)
8. **Character moods** - Add emotional depth
9. **Relationship milestones** - Track relationship progression
10. **Photo albums** - Expand media generation beyond single images

---

## Technical Debt & Improvements

- **Mobile responsiveness**: Optimize UI for phone screens
- **Performance**: Lazy loading for large conversation histories
- **Image optimization**: Compress/cache generated images better
- **WebSocket reliability**: Handle reconnection more gracefully
- **Error handling**: Better user-facing error messages
- **Loading states**: More consistent loading indicators across UI

---

## Out of Scope (For Now)

These ideas are interesting but may be too complex or divergent from core vision:

- Multiplayer/social features with other real users
- Monetization/premium features
- Character marketplace
- Mobile app (native)
- VR/AR integration
