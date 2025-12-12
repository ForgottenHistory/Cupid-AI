# Changelog

All notable changes to Cupid AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-12-12

### Added

#### Character Mood & State System
- **Character Mood**: Dynamic emotional state displayed as purple pill in chat header (e.g., "feeling flirty and playful")
- **Clickable Mood UI**: Click mood pill to manually edit character's mood
- **Character States**: Special behavior states (drunk, showering, etc.) shown as orange pill
- **State Instructions**: Character states inject special behavior instructions into chat prompts
- Mood/state triggers on TIME GAP or every 25 messages via Decision LLM
- Background mood updates with 25-message cooldown

#### AI Providers & Settings
- **NanoGPT Provider**: Third AI provider option alongside OpenRouter and Featherless
- **Extended Sampling Parameters**: OpenRouter models now support top_k, repetition_penalty, min_p when model supports them
- **Include Full Schedule**: New behavior setting to include complete weekly schedule in chat prompts
- **Proactive When Online**: Configure probability of proactive messages when character is online (0-100%)

#### Storage & Multi-Device
- **Backend-Only Storage**: All character data now stored in backend SQLite (no more IndexedDB)
- **Multi-Device Support**: Login from any browser/device and all characters are available
- **Per-User Config Files**: Each user has isolated prompt and tag library configurations

#### Library & Settings
- **Sort Dropdown**: Sort characters by Newest, Oldest, or Random in Library
- **SD Resolution Settings**: Configure width/height for Stable Diffusion image generation
- **Account Deletion**: Delete your account and all associated data from Danger Zone in Profile

### Changed
- Renamed "Content LLM" to "Chat LLM" in UI for clarity
- Proactive message generation now uses Metadata LLM (better for complex reasoning tasks)
- Character service refactored to use API calls instead of local storage
- Simplified ImageTab and CharacterProfile components (removed dual-save logic)

### Fixed
- **Character Rename**: Now properly updates name in prompts and syncs to backend
- **Empty Response Detection**: Detect and retry when AI returns just "Character Name:" with no content
- **RP Action Stripping**: Strip *asterisk* roleplay actions (system prompt forbids this formatting)
- **Schedule in Prompts**: Full schedule now placed correctly after system prompt
- **Delete-From Messages**: Now removes correct message instead of all messages with same timestamp
- **Typing Indicator**: Added server-side pending request tracking to prevent stuck indicators
- **Memory Degradation**: Apply degradation once per compaction session, add safeguards against memory loss
- **UI Lock on No Response**: Frontend now unlocks when character decides not to engage (30% chance)
- **User Created Date**: Migration fixes users with invalid created_at timestamp

### Removed
- IndexedDB storage (frontend/src/services/db.js, characterStorage.js)
- Character sync utilities (no longer needed with backend-only storage)

---

## [1.1.0] - 2025-11-30

### Added

#### Library Improvements
- **Search**: Search characters by name and tags with debounced input
- **Pagination**: 24 items per page (grid), 50 items per page (compact)
- **Compact View**: Toggle between grid and list views
- **Lazy Loading**: Images only load when scrolled into view

#### Sidebar Improvements
- **Search**: Click "Matches" title to search matches by name
- **Thumbnails**: Auto-generated thumbnails for faster sidebar loading

#### Chat Features
- **Message Swipes**: Navigate between message variants with arrow buttons
- **Image Regeneration**: Regenerate image messages with new SD generation
- **Conversation Export**: Export chat history as JSON from header menu
- **Persistent UI States**: Avatar visibility and banner collapsed states saved
- **TIME GAP Combining**: Consecutive time gap markers merged into single marker

#### Character System
- **V1 Card Support**: Import JanitorAI and other V1 format character cards
- **Character-Specific Image Prompts**: Override main/negative prompts per character
- **Post Instructions**: Custom instructions for character social media posts

#### Memory System
- **Memory Management UI**: Add, edit, delete memories from chat header
- **Remove All**: Bulk delete all memories with confirmation
- **Memory in Prompts**: Memories now included in all AI prompts
- **Memory Degradation**: Configurable point-based memory decay system
- **User Name in Memories**: Display actual username instead of "User"

#### LLM Configuration
- **Metadata LLM**: Fourth LLM type for character generation (profiles, schedules, personality)
- **Token Counter**: View token usage in Overview tab

#### Settings
- **Max Matches Limit**: Set maximum number of active matches (0-50)
- **Thought Frequency**: Configure how often characters share internal thoughts

### Changed
- Proactive message opener now randomly selects one variety instead of listing all
- Proactive check interval range extended to 5 minutes - 5 hours
- Message edit window now matches bubble size exactly
- Character profile layout changed to side-by-side

### Fixed
- Multi-line message ordering (messages with same timestamp now sort by ID)
- Duplicate AI responses now rejected and trigger retry
- Incomplete think tags detected and rejected
- LLM settings validation for OpenRouter provider
- Max matches limit now only counts characters with active conversations
- Duplicate TIME GAP markers prevented
- EM DASH replacement now properly uppercases next letter
- Character-specific image prompt overrides now properly applied
- Proactive message timing enforces interval between consecutive messages

### Removed
- Deprecated maxEmojisPerMessage setting
- Left-on-read settings (will reimplement later)

---

## [1.0.0] - 2025-11-01

### Initial Release

This is the first public release of Cupid AI, a dating app simulator with AI-powered characters that exhibit realistic behavior patterns.

#### Core Features

**Triple LLM Architecture**
- Content LLM for generating character responses
- Decision LLM for behavioral decisions (reactions, moods, unmatch, voice/image)
- Image Tag LLM for Danbooru tag generation
- Independent provider/model configuration per LLM (OpenRouter/Featherless)
- Request queuing with concurrency limits

**Character System**
- Import character cards from PNG v2 format
- Character Wizard for AI-generated characters (4-step process)
- AI-generated names, descriptions, appearances, and profile pictures
- Dating profiles with interests, fun facts, and preferences
- Weekly schedules with realistic online/away/busy/offline patterns
- Big Five (OCEAN) personality traits that influence behavior

**Chat System**
- Proactive messaging (characters message first after time gaps)
- Schedule-based engagement with time-based durations
- Time-aware conversations with automatic time gap markers
- Memory system (configurable 0-100 memories per character)
- Conversation compacting with AI summarization (configurable thresholds)
- Message reactions (emoji reactions on significant messages)
- Dynamic mood effects (hearts, stars, fire, etc.)
- Multi-message display with typing indicators

**Image Generation**
- Stable Diffusion WebUI integration
- Context-aware image generation during conversations
- Smart AI decisions (can send, tease, or refuse)
- Separate LLM for Danbooru tag generation
- Character profile picture generation

**Social Features**
- Tinder-style swipe interface (like/pass with undo)
- Daily auto-match system (configurable)
- Super likes (personality-based, 2 per day, guarantees first message)
- Social media feed with character posts
- Match management with unread indicators

**Customization**
- Extensive behavior settings (proactive messaging, memory, compaction, swipe limits)
- LLM configuration (3 independent systems with separate providers)
- Stable Diffusion settings (sampling, CFG, resolution, ADetailer)
- AI prompt customization (system prompts, decision engine, memory extraction)
- Tag library management for image generation

#### Technical Details

**Frontend**
- React + Vite
- Tailwind CSS for styling
- Socket.IO for real-time chat
- React Router for navigation

**Backend**
- Node.js + Express
- SQLite (better-sqlite3) for all data storage
- JWT authentication
- Socket.IO for real-time communication
- Multi-provider LLM support (OpenRouter, Featherless, NanoGPT)
- Exponential backoff retry logic for all AI services

**External Services**
- OpenRouter / Featherless / NanoGPT (LLM providers)
- Stable Diffusion WebUI (optional, for image generation)

#### Known Limitations

- Voice messages feature not yet implemented (marked as future feature)
- Left-on-read feature currently disabled

---

## Future Releases

See [IDEAS.md](IDEAS.md) for planned features and improvements.
