# Frontend File Registry

## Entry
- `main.jsx` - React entry point, router setup, AuthProvider
- `App.jsx` - Main app component, route definitions
- `index.html` - HTML template

## Pages
- `Login.jsx` - Login page
- `Signup.jsx` - Signup page
- `Home.jsx` - Tinder-style swipe interface
- `Library.jsx` - Character management, Character Wizard button
- `Chat.jsx` - Individual chat conversations, compacting overlay
- `Feed.jsx` - Full-screen social media feed (Instagram Stories style)
- `Profile.jsx` - User settings: profile, LLM, behavior, SD settings
- `Prompts.jsx` - AI behavior prompt editor (system, proactive, compaction, memory, etc.)
- `CharacterWizard.jsx` - 4-step AI character creation
- `VoiceLibrary.jsx` - Voice sample management (DISABLED)

## Layout
- `MainLayout.jsx` - Sidebar with matches, unread indicators, nav

## Context
- `AuthContext.jsx` - Auth state, user data, login/logout
- `MoodContext.jsx` - Mood effects (30-min auto-clear)

## Hooks
- `useChat.js` - Main chat hook: messages, pagination (200/page), sending, engagement, mood
- `useChatWebSocket.js` - WebSocket: new messages, typing, offline, unmatch, compacting events
- `useMessageActions.js` - Edit, delete, regenerate messages
- `useMessageDisplay.js` - Progressive display, smart auto-scroll (prepend detection), animations
- `useLLMSettings.js` - Load/save/update/reset LLM settings
- `useDarkMode.js` - Dark mode toggle

## Services
- `api.js` - Axios instance with auth token injection
- `authService.js` - Login, signup, token refresh
- `characterService.js` - IndexedDB CRUD for characters
- `characterStorage.js` - Low-level IndexedDB operations
- `chatService.js` - Backend API for conversations/messages, pagination support
- `socketService.js` - Socket.IO client, typing state tracking
- `db.js` - IndexedDB initialization

## Components - Home
- `SwipeCard.jsx` - Animated swipe card
- `SwipeActionButtons.jsx` - Pass, undo, like buttons
- `MatchModal.jsx` - Match animation
- `EmptyCardStack.jsx` - No characters state
- `CardCounter.jsx` - Remaining cards counter

## Components - Chat
- `ChatHeader.jsx` - Header with status, name, back button, memories button
- `ChatInput.jsx` - Message input, AI reply suggestions, image upload
- `MessageList.jsx` - Scrollable message list, Load More button, scroll preservation
- `MessageBubble.jsx` - Individual message with reactions, edit/delete
- `TypingIndicator.jsx` - Text-based typing indicator
- `SystemMessage.jsx` - System messages (departures, moods, TIME GAP markers)
- `ChatBackgroundEffects.jsx` - Dynamic mood backgrounds
- `MoodModal.jsx` - Mood change notification modal
- `MemoriesModal.jsx` - View character's long-term memories (50 max)
- `AudioPlayer.jsx` - Voice message player with effects (DISABLED)

## Components - Character Profile
- `CharacterProfile.jsx` - Main profile modal with tabs
- `OverviewTab.jsx` - Description, dating profile
- `ProfileTab.jsx` - Dating profile generation
- `ScheduleTab.jsx` - Weekly schedule generation
- `PersonalityTab.jsx` - Big Five traits with gradient bars
- `ImageTab.jsx` - Image tags configuration
- `VoiceTab.jsx` - Voice assignment (DISABLED)

## Components - Wizard
- `WizardProgress.jsx` - 4-step progress indicator
- `IdentityStep.jsx` - Age, archetype, personality traits
- `DescriptionStep.jsx` - LLM name + description generation
- `ImageStep.jsx` - LLM appearance + SD image generation
- `OptionsStep.jsx` - Auto-generation checkboxes, save

## Components - Settings
- `LLMSettings.jsx` - Tab manager for Content/Decision LLMs
- `LLMSettingsForm.jsx` - Shared form component
- `ModelSelector.jsx` - Search/filter model dropdown
- `SliderParameter.jsx` - Reusable slider
- `AdvancedSettings.jsx` - Collapsible advanced section
- `BehaviorSettings.jsx` - Emoji, proactive, pacing settings
- `SDSettings.jsx` - Stable Diffusion configuration
- `ImageGenSettings.jsx` - Image generation settings wrapper

## Components - Shared
- `CharacterGrid.jsx` - Grid layout for library
- `Emoji.jsx` - Emoji rendering with Twemoji
- `ImageModal.jsx` - Full-screen image viewer
- `UploadZone.jsx` - Drag-and-drop file upload
- `DailyMatchModal.jsx` - Daily auto-match notification
- `UnmatchModal.jsx` - Character unmatch notification
- `SuperLikeModal.jsx` - DEPRECATED (unused)
- `SwipeLimitModal.jsx` - Swipe limit reached modal
- `PostCard.jsx` - DEPRECATED (replaced by full-screen feed)
- `ProtectedRoute.jsx` - Auth-protected route wrapper
- `EmptyState.jsx` - Generic empty state component
- `GenerateButton.jsx` - Reusable generate button

## Utils
- `characterHelpers.js` - Status calculation, schedule helpers
- `characterImageParser.js` - PNG character card parsing (v2 format)
- `messageUtils.js` - Split messages by newlines for progressive display
- `syncCharacterImages.js` - Sync character images to backend
- `debugCompact.js` - Debug functions: testCompact, showBlockStructure, testMemoryExtraction, testCompactUI

## Config
- `vite.config.js` - Vite bundler config
- `eslint.config.js` - ESLint rules
- `package.json` - Dependencies, scripts
- `App.css` - Global styles
- `index.css` - Tailwind imports, custom scrollbar

## Notes
Voice features DISABLED. Uses Tailwind CSS, IndexedDB for offline storage, Socket.IO for real-time updates.
