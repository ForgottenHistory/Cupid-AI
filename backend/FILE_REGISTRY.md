# Backend File Registry

## Entry
- `server.js` - Express server, Socket.IO, routes, background services (proactive/posts checkers)

## Routes
- `auth.js` - Register, login, token refresh
- `users.js` - Profile, bio, LLM settings, behavior settings
- `characters.js` - Like, unlike, swipe limit, daily auto-match
- `chat.js` - Send, first-message, mark-read, edit, delete, regenerate, suggest-reply, debug-mood
- `wizard.js` - Character wizard: description, appearance, image generation
- `feed.js` - Fetch posts for all characters
- `sync.js` - Sync library characters to backend
- `tts.js` - Voice library (DISABLED)
- `debug.js` - Debug proactive/image generation

## Controllers
- `characterInteractionController.js` - Swipe limits, likes, daily auto-match
- `characterStatusController.js` - Dating profiles, schedules, personalities
- `aiGenerationController.js` - Posts, personality traits

## Services
- `aiService.js` - OpenRouter API, chat completions, prompt logging
- `messageProcessor.js` - Async message processing, engagement, mood, AI orchestration
- `conversationService.js` - Conversation CRUD, unread counts
- `messageService.js` - Message CRUD, history, edit/delete
- `decisionEngineService.js` - Decision LLM: reactions, moods, unmatch, media, proactive
- `engagementService.js` - Time-based engagement, departures, cooldowns
- `proactiveMessageService.js` - Background proactive: candidates, probability, first messages
- `postGenerationService.js` - Background posts: personality-based, 10/day
- `characterWizardService.js` - Wizard AI: names, descriptions, appearances, tags
- `personalityService.js` - Big Five (OCEAN) generation
- `sdService.js` - Stable Diffusion image generation
- `ttsService.js` - ChatterBox TTS (DISABLED)
- `promptBuilderService.js` - System prompt construction, schedule/proactive context
- `llmSettingsService.js` - User LLM settings, Content/Decision defaults
- `tokenService.js` - Token counting, context trimming (gpt-tokenizer)
- `authService.js` - JWT, bcrypt password hashing
- `superLikeService.js` - DEPRECATED (unused)
- `swipeLimitService.js` - Daily swipe limit (5/day)

## Database
- `database.js` - SQLite init, auto-migrations
- `schema.sql` - Schema: users, characters, conversations, messages, character_states, posts

## Middleware
- `auth.js` - JWT authentication

## Utils
- `characterHelpers.js` - Status calculation, personality helpers
- `chatHelpers.js` - Schedule status, time-based logic
- `logger.js` - File logging (auto-clears)

## Parsers & Prompts
- `characterParsers.js` - v2 card parsing, dating profile generation
- `characterPrompts.js` - System prompts for character generation

## Config
- `package.json` - Dependencies, scripts
- `.env` - Environment variables (not in git)
- `.env.example` - Env template

## Notes
Voice messages DISABLED, image messages ENABLED, super likes DEPRECATED. Logs: `logs/`, uploads: `uploads/`.
