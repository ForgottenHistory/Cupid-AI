# Changelog

All notable changes to Cupid AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- IndexedDB for character storage
- Socket.IO for real-time chat
- React Router for navigation

**Backend**
- Node.js + Express
- SQLite (better-sqlite3) for database
- JWT authentication
- Socket.IO for real-time communication
- Multi-provider LLM support (OpenRouter, Featherless)
- Exponential backoff retry logic for all AI services

**External Services**
- OpenRouter / Featherless (LLM providers)
- Stable Diffusion WebUI (optional, for image generation)

#### Known Limitations

- Voice messages feature not yet implemented (marked as future feature)
- Left-on-read feature currently disabled

---

## Future Releases

See [IDEAS.md](IDEAS.md) for planned features and improvements.
