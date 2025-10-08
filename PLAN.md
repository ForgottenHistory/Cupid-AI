# Cupid AI - Future Planning

## Vision: Dating App with Feed Discovery

**Core Concept**: AI dating app where characters post content to a feed, allowing organic discovery before DMing. The feed replaces the artificial swipe mechanic with a more natural "see interesting post → DM them" flow.

**Why the feed?**
- Swipe mechanic feels tacked on (glorified upload button)
- Feed enables natural discovery (see someone's personality through their posts)
- Characters can show their personality/interests through posts
- More engaging than static profiles
- Existing features (Decision Engine, engagement system, proactive messaging) integrate naturally

---

## Current State

### What We Have
✅ **Core Dating App**: Chat system, character library, matches, proactive messaging
✅ **Feed System** (Phase 1): Full-screen post view, character post generation, navigation
✅ **Character AI**: Dual LLM system (Decision Engine + Content Generator)
✅ **Engagement System**: Schedule-based status, time-based engagement, cooldowns
✅ **Character Creation**: Import character cards OR use Character Wizard
✅ **Personality System**: Big Five traits affect post frequency and behavior
✅ **Image Generation**: SD integration for profile pics and message images

### What the Feed Does
- Characters generate short text posts (1-3 sentences)
- Full-screen single-post view (Instagram Stories style)
- Large avatar on left (320px), content on right
- Navigate with arrow buttons or keyboard (← →)
- Click avatar/name to DM character
- 10 posts/day cap, personality-weighted generation
- Posts run in background (every 60 minutes)

---

## Future Plans

### Phase 2: Image Posts
**Goal**: Characters can post images, not just text

**Features**:
- Extend post generation to create image posts
- Use existing SD integration for image generation
- LLM generates context-aware image tags
- Display images in feed (similar to message images)
- Mix text-only and image posts in feed

**Implementation**:
- Add image generation decision to post service
- Reuse image generation logic from message system
- Store image_url in posts table (already exists)
- Update Feed.jsx to display image posts

### Phase 3: Simple Interactions
**Goal**: Basic engagement with posts without building full social media

**Potential Features** (not all necessary):
- Like button on posts (optional, visual feedback only)
- View character's recent posts (click character → see their post history)
- Filter feed by character (discover mode: see all posts from one character)
- Simple post counter per character (how active they are)

**Keep it Simple**:
- No comments (that's what DMs are for)
- No following/unfollowing (just browse chronologically)
- No notifications (keep it chill)
- No user posts (this is about discovering AI characters, not social media)

### Phase 4: Enhanced Discovery
**Goal**: Better ways to find interesting characters

**Features**:
- Character profile view (bio + recent posts)
- Search characters by name/archetype
- Filter feed by archetype or personality traits
- "More from this character" view (see all their posts)
- Random character suggestion (based on personality match)

---

## Implementation Details

### Phase 1: Core Feed System ✅ COMPLETED

**What We Built**:
- Posts table with character_id, content, timestamps, image_url
- Post generation service (10 posts/day cap, personality-weighted)
- Feed API endpoint (GET /api/feed) with pagination
- Full-screen Feed.jsx with state-based navigation
- Character image sync from IndexedDB to backend
- Smooth slide animations (300ms transitions)
- Keyboard navigation support

**Architecture**:
- Backend: `postGenerationService.js`, `routes/feed.js`, `routes/sync.js`
- Frontend: `Feed.jsx` with arrow navigation + keyboard support
- Database: `posts` table, `image_url` column in characters table
- Personality-weighted selection (extraversion + openness traits)

**Existing Features Kept**:
- Discover tab (swipe interface) - works in parallel
- Chat/DM system - unchanged
- Library - unchanged
- All existing AI features (Decision Engine, proactive messaging, etc.)

**Post Generation Logic**:
- Runs every 60 minutes + once at startup
- 10 posts/day cap (resets at midnight)
- Generates 1-2 posts per run
- Only characters with online/away status post
- Content LLM generates 1-3 sentence posts based on character personality

---

## Open Questions

**Image Posts**:
- How often should characters post images vs text? (e.g., 1 in 5 posts?)
- Should image posts use different prompt style?

**Feed Experience**:
- Should we add a "shuffle" button to randomize post order?
- Should we add a "jump to random post" feature?
- Should we show timestamp or make it ambiguous?

**Discovery**:
- Should we add a "similar characters" feature?
- Should we track which posts led to DMs?

---

## Tech Stack

**Frontend**: React + Tailwind + Vite
**Backend**: Node.js + Express + SQLite
**AI**: OpenRouter (dual LLM system: Decision + Content)
**Storage**: IndexedDB (frontend) + SQLite (backend)
**Image Generation**: Stable Diffusion WebUI

---

## Future Enhancements (Maybe Someday)

### Content Variety
- Voice posts (use existing TTS system)
- Multi-image posts (SD generates image sets)
- Character "status" posts (quick one-liners, more frequent)

### AI Improvements
- Posts reference ongoing DM conversations
- Characters mention things from past chats in posts
- Post topics evolve based on user interactions
- Mood affects post tone (happy, sad, flirty, etc.)

### Discovery
- "Trending" characters (most engaging posts)
- Topic-based filtering (fitness, gaming, art, etc.)
- Character compatibility scoring for recommendations

### Engagement
- Track which posts led to DMs (analytics for fun)
- "Post of the day" highlight
- Character post streaks (how many days in a row they've posted)

---

## Notes

- **Keep it dating-focused**: Feed is for discovery, DMs are for connection
- **No social media bloat**: No comments, followers, notifications, etc.
- **Character autonomy**: Characters post naturally based on personality
- **Single-user focus**: No multi-tenancy complexity
- **Leverage existing features**: Reuse Decision Engine, engagement system, image generation
- **Quality over quantity**: 10 posts/day keeps feed fresh without overwhelming
