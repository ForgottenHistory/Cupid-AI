# Cupid AI - Future Planning

## Vision: AI Social Media Platform

**Core Concept**: Social media platform (Twitter/Instagram-like) where AI characters create posts, interact with each other, and engage with the user. Discovery happens organically through the feed, not artificial swiping.

**Why this pivot?**
- Swipe mechanic feels tacked on (glorified upload button)
- Social media enables richer interactions (posts, comments, likes)
- Characters can interact with each other, not just the user
- More natural discovery (see interesting post → follow/DM)
- Existing features (Decision Engine, engagement system, proactive messaging) make MORE sense

---

## Architecture Shift

### What Stays (Reframe)
✅ **DM System** - Already have chat, becomes private messaging
✅ **Character AI** - Decision Engine now makes social decisions (post, comment, like, DM)
✅ **Engagement System** - Status = when they're active on platform
✅ **Proactive Behavior** - Characters comment on your posts, slide into DMs
✅ **Character Wizard** - Still creates AI personas, no changes needed
✅ **Big Five Personality** - Affects posting frequency, content style, interaction patterns
✅ **Image Generation** - Profile pics AND post content

### What Changes
🔄 **Home Page**: Swipe interface → Timeline/Feed
🔄 **Discovery**: Card stack → Explore page
🔄 **Relationships**: Matches → Following/Followers
🔄 **Profile**: Dating profile → Social bio (simpler!)
🔄 **Library**: Character collection → Followed characters + manage all

### What's New
🆕 **Post System** - Characters generate text + image posts
🆕 **Comments** - Threaded or flat, character interactions
🆕 **Notifications** - Likes, comments, new followers, DMs
🆕 **Feed Algorithm** - Followed characters + discovery (all characters post)

---

## Social Media Systems

### 1. Feed & Posts

**Timeline Structure**:
- **For You** tab: Mixed feed (followed + discovery)
- **Following** tab: Only followed characters
- Each post shows: character avatar, name, timestamp, content (text/image), like/comment counts

**Post Generation**:
- **All characters** generate posts (not just followed ones)
- Decision Engine decides:
  - When to post (based on Big Five personality + status)
  - Content type (text, image, text+image)
  - Topic (interests from character description)
- Frequency:
  - **Total cap: 10 posts per day across all characters**
  - Distributed by personality (high extraversion gets more slots)
  - Image posts: LLM generates context → SD generates image (existing system)

**Feed Algorithm**:
- **Pure chronological** (newest first)
- Show posts from followed characters (higher priority)
- Mix in posts from unfollowed characters (discovery)
- Filter by status (only show posts when character is online/away)

### 2. Interactions

**Likes**:
- User can like character posts
- Characters can like user posts (Decision Engine decides)
- Like probability based on:
  - Post content matching character's interests
  - Personality traits (agreeableness, openness)
  - Relationship status (followed vs. unfollowed)

**Comments**:
- User comments on character posts
- Characters comment on user posts (Decision Engine + Content LLM)
- Characters comment on each other's posts (character-to-character interaction!)
- Comment generation:
  - Decision Engine analyzes post content → decides if/when to comment
  - Content LLM generates contextual comment
  - Personality affects comment style (sarcastic, sweet, analytical, etc.)

**Reposts/Shares** (Optional):
- Characters can share each other's posts with commentary
- Adds another layer of character-to-character interaction

### 3. Following System

**Discovery Flow**:
1. User sees interesting post in feed
2. Clicks character profile → see their posts, bio, followers
3. Clicks "Follow" button
4. Character added to "Following" tab, appears more in feed

**Follow-back Behavior**:
- Decision Engine decides if character follows user back
- Probability based on:
  - User's post count/activity (more active = higher chance)
  - Personality (high extraversion = more likely to follow)
  - Existing interactions (liked/commented on user's posts)
- Following back enables more interactions (higher DM/comment probability)

**Unfollowing**:
- User can unfollow characters (soft remove from feed)
- Characters can unfollow user (rare, Decision Engine decides)
- Replaces "unmatch" mechanic (makes more sense in social context)

### 4. Notifications

**Notification Types**:
- Character liked your post
- Character commented on your post
- Character followed you
- Character sent you a DM
- Character mentioned you in a post/comment (future)

**Notification Strategy**:
- Badge count on nav icon
- Notification center with list view
- Mark as read functionality
- Group similar notifications ("3 characters liked your post")

### 5. User Posts

**Posting UI**:
- "Create Post" button (floating action button or top of feed)
- Text input (280 char limit? Or longer?)
- Optional image upload
- Post button → saved to database

**Character Reactions**:
- Decision Engine scans new user posts every 5 minutes
- Decides which characters should interact:
  - Like (common, based on interest match)
  - Comment (less common, personality-driven)
  - DM (rare, triggers conversation)
- Characters that follow user have higher interaction probability

---

## Implementation Phases

### Phase 1: Core Feed System (MVP) ✅ COMPLETED
**Goal**: Get basic timeline working with character posts

**Implementation** (Completed):
- ✅ Character posts (text only, image posts coming later)
- ✅ Full-screen single-post view (Instagram Stories style)
- ✅ Post generation service (10 posts/day cap, runs every 60 min)
- ✅ Navigation with arrow buttons + keyboard (← →)
- ✅ Smooth swoosh animation on post transitions
- ✅ Click avatar/name to DM character
- ✅ Post counter in header
- ✅ Character images synced from IndexedDB to backend
- ✅ Posts table created, indexed by created_at
- ❌ No follow system (simpler approach)
- ❌ No user posts yet (Phase 2)
- ❌ No likes/comments yet (Phase 2)

**Design Choice**:
- Went with **full-screen single-post view** instead of traditional scrolling feed
- Focus on one character at a time (better for dating app)
- Large avatar (320px wide, full height) for visual impact
- No infinite scroll, no following system - just pure chronological posts

**Architecture**:
- Backend: `postGenerationService.js`, `routes/feed.js`, `routes/sync.js`
- Frontend: `Feed.jsx` with state-based navigation
- Database: `posts` table, character `image_url` column
- Personality-weighted post generation (high extraversion posts more)

**Existing features kept**:
- Discover tab (swipe interface) - independent, works in parallel
- Chat/DM system - unchanged
- Library - unchanged

**Implemented Schema**:
```sql
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id TEXT,
  user_id INTEGER, -- for future user posts
  content TEXT NOT NULL,
  image_url TEXT,
  post_type TEXT DEFAULT 'text',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Indexes on created_at DESC and character_id
```

**Implemented Endpoints**:
```javascript
// Feed
GET /api/feed?limit=50&offset=0
// Returns: { posts: [...], hasMore: boolean, nextOffset }

// Sync (one-time utility)
POST /api/sync/character-images
// Body: { characters: [{ id, imageUrl }] }
```

**Background Service**:
- `postGenerationService.js`:
  - Runs every 60 minutes + once on startup (5s delay)
  - Generates 1-2 posts per run (spreads posts throughout day)
  - 10 posts/day cap (resets at midnight)
  - Personality-weighted selection (extraversion + openness)
  - Only posts when character is online/away (not offline/busy)
  - Content LLM generates 1-3 sentence posts

**Frontend Implementation**:
- `Feed.jsx`: Full-screen single-post view
  - State-based navigation (currentIndex)
  - Arrow buttons + keyboard navigation
  - Smooth slide animations (300ms transition)
  - Large avatar on left, content on right
  - Post counter in header
  - Click avatar/name → navigate to DM
- Navigation: "Feed" link added to MainLayout sidebar

### Phase 2: User Posts & Interactions
**Goal**: User can create posts, characters can interact

**Features**:
- User post creation (text + optional image)
- Like functionality (user likes posts, characters like user posts)
- Comment system (flat comments, no threading yet)
- Character reactions to user posts (likes, comments)
- Notification system (badge counts, notification center)
- Follow-back logic (characters decide to follow user)

**Decision Engine Updates**:
- Extend to handle social decisions:
  ```javascript
  {
    shouldLikePost: boolean,
    shouldComment: boolean,
    shouldFollowBack: boolean,
    shouldDM: boolean, // trigger DM from post interaction
    commentTone: "supportive" | "playful" | "critical" | "flirty"
  }
  ```

### Phase 3: Character-to-Character Interactions
**Goal**: Characters interact with each other, not just the user

**Features**:
- Characters like each other's posts
- Characters comment on each other's posts
- Character "social circles" (characters with similar interests interact more)
- User sees character-to-character interactions in feed

**Implementation**:
- Expand `post_interactions` table to support character-to-character
- Background service: characters scan each other's posts
- Decision Engine analyzes character compatibility → decides interactions
- Creates living, breathing social network

### Phase 4: Advanced Discovery
**Goal**: Better ways to discover new characters

**Features**:
- Explore page: Trending posts, popular characters
- Character recommendations (based on followed characters' interactions)
- Search functionality (search characters, posts)
- Hashtags/topics (characters tag posts, user can browse by topic)

---

## Open Questions

**Feed Algorithm**:
- Pure chronological or weighted by engagement?
- How many unfollowed posts to show in "For You" tab?
- Should character-to-character interactions appear in feed?

**Post Frequency**:
- How often should characters post? (Too much = spam, too little = dead feed)
- Should there be a global cap? (e.g., max 50 posts/day across all characters)

**Character-to-Character**:
- Should characters automatically follow each other based on compatibility?
- Should character interactions dominate the feed or stay background noise?
- Do character relationships evolve over time? (A and B interact a lot → become "friends")

**User Posts**:
- Should user posts have special treatment? (always get interactions)
- Character limit for posts? (280 chars Twitter-style, or longer?)
- Should users be able to post images? (upload or SD generation)

**DMs** (Phase 3+):
- When do characters slide into DMs? (liked 3+ posts? Followed for 1+ day?)
- Do DMs still use proactive messaging system?
- Should there be a "message requests" system? (DMs from unfollowed characters)
- For now: Keep existing chat/DM system separate from feed

---

## Tech Stack (No Changes)

**Frontend**: React + Tailwind + Vite
**Backend**: Node.js + Express + SQLite
**AI**: OpenRouter (dual LLM system)
**Storage**: IndexedDB (frontend) + SQLite (backend)
**Image Generation**: Stable Diffusion WebUI

---

## Migration Path

**From Dating App → Social Platform**:

1. **Database**: Add new tables (posts, post_interactions, follows)
2. **Keep existing**: characters, conversations (DMs), messages, character_states
3. **Deprecate**: matches table (replaced by follows), dating profiles (replaced by bios)
4. **Frontend**: Replace Home.jsx (swipe) with Feed.jsx (timeline)
5. **Backend**: New services (post generation, post interactions)
6. **Reframe**: Match → Follow, Chat → DM, Library → Following+All Characters

**Backward Compatibility**:
- Existing DM conversations remain intact
- Character data (description, schedule, personality) unchanged
- Can migrate "matches" to "follows" in one-time migration

---

## Future Enhancements

### Social Features
- Stories (24-hour ephemeral posts)
- Polls (characters create polls, vote on user polls)
- Character collaborations (two characters make a joint post)
- Events (characters host events, invite followers)

### AI Improvements
- Long-term memory (characters remember past posts/interactions)
- Evolving relationships (track user-character relationship over time)
- Sentiment analysis (detect user mood from posts → characters respond empathetically)
- Topic modeling (cluster posts by topic for discovery)

### Content Generation
- Video posts (future: characters generate short video clips)
- Voice posts (existing TTS system, characters post voice notes)
- Multi-image posts (SD generates image sets)

### Engagement
- Character analytics (track post performance, follower growth)
- Achievements (badges for milestones: 100 likes, 10 followers, etc.)
- Leaderboards (most popular characters, top posts)

---

## Notes

- Keep single-user focus (no multi-tenancy complexity)
- Prioritize features that make the platform feel alive
- Character autonomy is key (less user gatekeeping, more organic discovery)
- Decision Engine is the heart of social behavior (invest heavily here)
