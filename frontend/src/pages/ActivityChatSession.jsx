import { useRef, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMood } from '../context/MoodContext';
import { getImageUrl } from '../services/api';
import chatService from '../services/chatService';
import characterService from '../services/characterService';

// Use the real chat hooks
import { useChat } from '../hooks/useChat';
import { useMessageDisplay } from '../hooks/useMessageDisplay';
import { useChatWebSocket } from '../hooks/useChatWebSocket';
import { useMessageActions } from '../hooks/useMessageActions';

// Reuse chat components
import MessageList from '../components/chat/MessageList';
import ChatInput from '../components/chat/ChatInput';
import ChatHeader from '../components/chat/ChatHeader';
import ChatBackgroundEffects from '../components/chat/ChatBackgroundEffects';

// Activity session hook
import { useActivitySession, PHASE } from '../hooks/useActivitySession';

/**
 * Activity Chat Session - uses real chat infrastructure with activity overlay
 * This is the new unified component for Random Chat and Blind Date
 */
const ActivityChatSession = ({ user, mode = 'random', onBack }) => {
  const inputRef = useRef(null);
  const proactiveTimeoutRef = useRef(null);
  const immediateTimeoutRef = useRef(null);

  // Activity session state (timer, phases, decisions)
  const activity = useActivitySession(user, mode);

  const {
    phase,
    error: activityError,
    conversationId,
    character,
    characterName,
    characterStatus,
    chatDuration,
    timeRemaining,
    formatTime,
    userDecision,
    characterDecision,
    characterReason,
    decidingCharacter,
    isMatch,
    userFirstChance,
    startSession,
    endSession,
    handleUserDecision,
    handleMatchAction,
    resetSession,
  } = activity;

  // Only use chat hooks when we have a conversation
  const characterId = character?.id;

  // Mood context for background effects
  const { getMoodForCharacter } = useMood();
  const { effect: backgroundEffect, visible: backgroundVisible } = getMoodForCharacter(characterId);

  // Core chat state - this fetches messages from the real conversation
  const chatState = useChat(characterId, user, conversationId);

  const {
    character: chatCharacter,
    conversation,
    messages,
    setMessages,
    loading: chatLoading,
    error: chatError,
    setError,
    messagesEndRef,
    isMountedRef,
  } = chatState;

  // Use the activity character data (more complete) or fall back to chat character
  const displayCharacter = character || chatCharacter;

  // Message display and animation
  const {
    newMessageIds,
    displayingMessages,
    setDisplayingMessages,
    markMessageAsNew,
    addDisplayTimeout,
    clearDisplayTimeouts,
  } = useMessageDisplay(messages, messagesEndRef, false);

  // Message actions (send, regenerate, edit, delete)
  const {
    sending,
    setSending,
    input,
    setInput,
    editingMessageId,
    editingText,
    setEditingText,
    showTypingIndicatorInternal,
    setShowTypingIndicatorInternal,
    handleSend,
    handleRegenerateLast,
    handleDeleteFrom,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
  } = useMessageActions({
    characterId,
    character: displayCharacter,
    messages,
    setMessages,
    setConversation: () => {}, // Activities don't need to update conversation
    setError,
    isMountedRef,
    markMessageAsNew,
    setDisplayingMessages,
    addDisplayTimeout,
    inputRef,
    selectedImage: null,
    setSelectedImage: () => {},
    imageDescription: '',
    setImageDescription: () => {},
  });

  // WebSocket for real-time messaging
  const wsState = useChatWebSocket({
    characterId,
    user,
    isMountedRef,
    setMessages,
    setSending,
    setError,
    markMessageAsNew,
    setDisplayingMessages,
    addDisplayTimeout,
    inputRef,
    setAllImageUrls: () => {},
  });

  const { showTypingIndicator } = wsState;

  // Track if we've already set up first message for this session
  const firstMessageSetupRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const userFirstChanceRef = useRef(userFirstChance);
  userFirstChanceRef.current = userFirstChance;
  const [waitingForFirstMessage, setWaitingForFirstMessage] = useState(false);

  // First message logic - simple and direct, not using the hook's proactive system
  useEffect(() => {
    if (phase !== PHASE.CHATTING || !conversationId || !character) {
      return;
    }

    // Only set up once per conversation
    if (firstMessageSetupRef.current === conversationId) {
      return;
    }
    firstMessageSetupRef.current = conversationId;

    // userFirstChance is actually "character first chance" (0% = you always first, 100% = character always first)
    // Use ref to get the latest value, not the stale closure value
    const currentUserFirstChance = userFirstChanceRef.current;
    const characterGoesFirst = Math.random() * 100 < currentUserFirstChance;

    const sendFirstMessage = async () => {
      // Check if still no messages (use ref for current value)
      if (messagesRef.current.length > 0) {
        console.log('🎲 Messages already exist, skipping first message');
        return;
      }

      setWaitingForFirstMessage(true);
      try {
        console.log(`🎲 Generating first message for activity conversation ${conversationId}`);
        const characterData = character.cardData?.data || character.cardData;
        const response = await chatService.generateFirstMessage(character.id, characterData, {
          conversationId,
          activityMode: mode,
        });

        if (response?.messages) {
          console.log(`🎲 First message generated for activity`);
          setMessages(response.messages);
          response.messages.forEach(msg => markMessageAsNew(msg.id));
        }
      } catch (err) {
        console.error('Failed to generate first message:', err);
        setError('Failed to start conversation');
      } finally {
        setWaitingForFirstMessage(false);
      }
    };

    if (characterGoesFirst) {
      // Character goes first: 1-3 second delay
      const delay = 1000 + Math.random() * 2000;
      console.log(`🎲 Character goes first (${currentUserFirstChance}% chance) - sending message in ${Math.round(delay)}ms`);
      setTimeout(sendFirstMessage, delay);
    } else {
      // User goes first: wait 15 seconds, then if no messages, character sends
      console.log(`🎲 User goes first (${100 - currentUserFirstChance}% chance) - character will send if no messages in 15s`);
      setTimeout(sendFirstMessage, 15000);
    }
    // No cleanup - we want the timeout to fire even if effect re-runs
    // The ref guard prevents duplicate setup, and sendFirstMessage checks for existing messages
  }, [phase, conversationId, character, mode, setMessages, markMessageAsNew, setError]);

  // Swipe state (simplified for activities)
  const [messageSwipes] = useState({});
  const [messageSwipeIndex] = useState({});
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Blind date reveal animation state
  const [showReveal, setShowReveal] = useState(false);

  // Swipe handler
  const handleSwipe = async (messageId, swipeIndex) => {
    try {
      const response = await chatService.swipeMessage(messageId, swipeIndex);
      if (response.success && response.message) {
        setMessages(prev => prev.map(msg =>
          msg.id === messageId ? { ...msg, ...response.message } : msg
        ));
      }
    } catch (error) {
      console.error('Failed to swipe message:', error);
      setError('Failed to switch response variant');
    }
  };

  // Regenerate handler
  const handleRegenerate = async (messageId) => {
    if (!displayCharacter) return;

    setIsRegenerating(true);
    try {
      const response = await chatService.regenerateMessage(messageId, displayCharacter);
      if (response.success && response.message) {
        setMessages(prev => prev.map(msg =>
          msg.id === messageId ? { ...msg, ...response.message } : msg
        ));
      }
    } catch (error) {
      console.error('Failed to regenerate message:', error);
      setError('Failed to generate new response');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Suggest reply handler
  const handleSuggestReply = async (style) => {
    if (!characterId || !displayCharacter) return null;

    try {
      const response = await chatService.suggestReply(characterId, style, displayCharacter);
      return response.suggestion;
    } catch (error) {
      console.error('Failed to get suggestion:', error);
      return null;
    }
  };

  // Get character image URL
  const getCharacterImageUrl = () => {
    const imgUrl = displayCharacter?.imageUrl || displayCharacter?.image_url;
    if (!imgUrl) return null;
    if (imgUrl.startsWith('data:')) return imgUrl;
    return getImageUrl(imgUrl);
  };

  // Blind date mode - show first initial only
  const firstInitial = characterName.charAt(0).toUpperCase() + '.';
  const displayName = mode === 'blind' && phase === PHASE.CHATTING
    ? firstInitial
    : characterName;

  // Create a "blind" character object for blind date mode (hides real name in typing indicator, etc.)
  const blindCharacter = displayCharacter && mode === 'blind' ? {
    ...displayCharacter,
    name: firstInitial,
  } : displayCharacter;

  // Handle back - reset and go to hub
  const handleBack = () => {
    resetSession();
    setShowReveal(false);
    onBack();
  };

  // Handle reveal for blind date - just shows the identity, doesn't auto-proceed
  const handleReveal = () => {
    setShowReveal(true);
  };

  // Combine errors
  const error = activityError || chatError;

  // Render IDLE phase
  if (phase === PHASE.IDLE) {
    const modeConfig = mode === 'blind' ? {
      title: 'Blind Date',
      description: "Chat without knowing who you're talking to. Only their first initial is shown. Match to reveal their identity!",
      icon: (
        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ),
      gradient: 'from-amber-500 to-rose-500',
    } : {
      title: 'Random Chat',
      description: 'Chat with a random character for 10 minutes. At the end, both of you decide whether to match. If you both say yes, it\'s a match!',
      icon: (
        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-pink-500 to-purple-600',
    };

    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="text-center max-w-md">
          {/* Back button */}
          <button
            onClick={handleBack}
            className="absolute top-4 left-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className={`w-24 h-24 bg-gradient-to-br ${modeConfig.gradient} rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg`}>
            {modeConfig.icon}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            {modeConfig.title}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {modeConfig.description}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={startSession}
            className={`px-8 py-4 bg-gradient-to-r ${modeConfig.gradient} text-white font-semibold rounded-full hover:opacity-90 transition shadow-lg hover:shadow-xl`}
          >
            Start {modeConfig.title}
          </button>
        </div>
      </div>
    );
  }

  // Render LOADING phase
  if (phase === PHASE.LOADING) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Finding someone for you...</p>
      </div>
    );
  }

  // Render DECIDING phase
  if (phase === PHASE.DECIDING) {
    // First initial for blind date display
    const firstInitial = characterName.charAt(0).toUpperCase() + '.';

    return (
      <div className={`h-full flex flex-col items-center justify-center p-8 ${
        mode === 'blind'
          ? 'bg-gradient-to-b from-amber-50 to-rose-50 dark:from-gray-900 dark:to-gray-800'
          : 'bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800'
      }`}>
        <div className="text-center max-w-md">
          {mode === 'blind' ? (
            /* Blind Date: Mystery silhouette */
            <div className="w-32 h-32 rounded-full mx-auto mb-6 ring-4 ring-amber-500 shadow-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
              <span className="text-5xl font-bold text-white/80">{firstInitial}</span>
            </div>
          ) : (
            /* Random Chat: Show character image */
            getCharacterImageUrl() && (
              <img
                src={getCharacterImageUrl()}
                alt={characterName}
                className="w-32 h-32 rounded-full object-cover mx-auto mb-6 ring-4 ring-purple-500 shadow-xl"
              />
            )
          )}

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Time's Up!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your chat with <span className={`font-medium ${mode === 'blind' ? 'text-amber-600 dark:text-amber-400' : 'text-purple-600 dark:text-purple-400'}`}>{mode === 'blind' ? firstInitial : characterName}</span> has ended.
            {mode === 'blind' ? ' Would you like to reveal who they are?' : ' Would you like to match with them?'}
          </p>

          {!userDecision && !decidingCharacter && (
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => handleUserDecision('no')}
                className="px-8 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Pass
              </button>
              <button
                onClick={() => handleUserDecision('yes')}
                className={`px-8 py-3 text-white font-medium rounded-full transition ${
                  mode === 'blind'
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600'
                    : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700'
                }`}
              >
                {mode === 'blind' ? 'Reveal & Match!' : 'Match!'}
              </button>
            </div>
          )}

          {decidingCharacter && !characterDecision && (
            <div className="flex flex-col items-center gap-4">
              <div className={`animate-spin w-8 h-8 border-4 border-t-transparent rounded-full ${
                mode === 'blind' ? 'border-amber-500' : 'border-purple-500'
              }`} />
              <p className="text-gray-600 dark:text-gray-400">
                {mode === 'blind' ? firstInitial : characterName} is deciding...
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render RESULT phase
  if (phase === PHASE.RESULT) {
    // First initial for blind date
    const firstInitial = characterName.charAt(0).toUpperCase() + '.';

    return (
      <div className={`h-full flex flex-col items-center justify-center p-8 ${
        mode === 'blind'
          ? 'bg-gradient-to-b from-amber-50 to-rose-50 dark:from-gray-900 dark:to-gray-800'
          : 'bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800'
      }`}>
        <div className="text-center max-w-md">
          {isMatch ? (
            <>
              {/* Blind Date: Reveal animation */}
              {mode === 'blind' ? (
                <>
                  <div className="relative mb-8">
                    <div className="w-32 h-32 mx-auto relative">
                      {/* Mystery overlay that fades out */}
                      <div className={`absolute inset-0 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center ring-4 ring-amber-500 shadow-xl transition-opacity duration-1000 ${showReveal ? 'opacity-0' : 'opacity-100'}`}>
                        <span className="text-5xl font-bold text-white/80">{firstInitial}</span>
                      </div>

                      {/* Actual image that fades in */}
                      {getCharacterImageUrl() && (
                        <img
                          src={getCharacterImageUrl()}
                          alt={characterName}
                          className={`w-32 h-32 rounded-full object-cover ring-4 ring-pink-500 shadow-xl transition-opacity duration-1000 ${showReveal ? 'opacity-100' : 'opacity-0'}`}
                        />
                      )}

                      <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-gradient-to-br from-amber-500 to-rose-500 rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-rose-500 mb-3">
                    It's a Match!
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    {showReveal ? (
                      <>Your mystery match was <span className="font-bold text-rose-500">{characterName}</span>!</>
                    ) : (
                      'Click to reveal who you matched with!'
                    )}
                  </p>
                  {characterReason && showReveal && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 italic mb-2">
                      "{characterReason}"
                    </p>
                  )}

                  {!showReveal ? (
                    <button
                      onClick={handleReveal}
                      className="mt-6 px-8 py-4 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold rounded-full hover:from-amber-600 hover:to-rose-600 transition shadow-lg hover:shadow-xl animate-pulse"
                    >
                      Reveal Identity
                    </button>
                  ) : (
                    <button
                      onClick={handleMatchAction}
                      className="mt-6 px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-full hover:from-pink-600 hover:to-purple-700 transition shadow-lg hover:shadow-xl"
                    >
                      Start Chatting
                    </button>
                  )}
                </>
              ) : (
                /* Random Chat: Normal match display */
                <>
                  <div className="relative mb-8">
                    <div className="w-32 h-32 mx-auto relative">
                      {getCharacterImageUrl() ? (
                        <img
                          src={getCharacterImageUrl()}
                          alt={characterName}
                          className="w-32 h-32 rounded-full object-cover ring-4 ring-pink-500 animate-pulse shadow-xl"
                        />
                      ) : (
                        <div className="w-32 h-32 rounded-full ring-4 ring-pink-500 animate-pulse shadow-xl bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                          <span className="text-4xl font-bold text-white">{characterName.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 mb-3">
                    It's a Match!
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    You and {characterName} both wanted to connect!
                  </p>
                  {characterReason && (
                    <p className="text-sm text-purple-600 dark:text-purple-400 italic mb-8">
                      "{characterReason}"
                    </p>
                  )}
                  {!characterReason && <div className="mb-8" />}

                  <button
                    onClick={handleMatchAction}
                    className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-full hover:from-pink-600 hover:to-purple-700 transition shadow-lg hover:shadow-xl"
                  >
                    Start Chatting
                  </button>
                </>
              )}
            </>
          ) : (
            /* No Match */
            <>
              {mode === 'blind' ? (
                /* Blind Date No Match - reveal identity */
                <div className="relative mb-6">
                  <div className="w-32 h-32 mx-auto relative">
                    {/* Actual image underneath (greyed out) */}
                    {getCharacterImageUrl() && (
                      <img
                        src={getCharacterImageUrl()}
                        alt={characterName}
                        className={`w-32 h-32 rounded-full object-cover ring-4 ring-gray-400 shadow-xl grayscale transition-opacity duration-1000 ${showReveal ? 'opacity-50' : 'opacity-0'}`}
                      />
                    )}
                    {/* Mystery overlay on top that fades out */}
                    <div className={`absolute inset-0 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center ring-4 ring-gray-500 shadow-xl transition-opacity duration-1000 z-10 ${showReveal ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                      <span className="text-5xl font-bold text-white/50">{firstInitial}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Random Chat No Match - show image greyed out */
                getCharacterImageUrl() && (
                  <img
                    src={getCharacterImageUrl()}
                    alt={characterName}
                    className="w-32 h-32 rounded-full object-cover mx-auto mb-6 opacity-50 grayscale"
                  />
                )
              )}

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                No Match
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                {mode === 'blind' ? (
                  showReveal ? (
                    <>
                      {userDecision === 'no' && characterDecision === 'no' && <>Neither of you wanted to match. It was <span className="font-bold text-amber-500">{characterName}</span>!</>}
                      {userDecision === 'yes' && characterDecision === 'no' && <>It was <span className="font-bold text-amber-500">{characterName}</span> — they weren't feeling it this time.</>}
                      {userDecision === 'no' && characterDecision === 'yes' && <>It was <span className="font-bold text-amber-500">{characterName}</span> — they wanted to match, but you passed.</>}
                    </>
                  ) : (
                    'Tap to reveal who it was!'
                  )
                ) : (
                  <>
                    {userDecision === 'no' && characterDecision === 'no' && "Neither of you wanted to match. That's okay!"}
                    {userDecision === 'yes' && characterDecision === 'no' && `${characterName} wasn't feeling it this time.`}
                    {userDecision === 'no' && characterDecision === 'yes' && `${characterName} wanted to match, but you passed.`}
                  </>
                )}
              </p>
              {characterReason && (mode !== 'blind' || showReveal) && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-2">
                  "{characterReason}"
                </p>
              )}

              {mode === 'blind' && !showReveal ? (
                <button
                  onClick={handleReveal}
                  className="mt-6 mb-8 px-8 py-4 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold rounded-full hover:from-amber-600 hover:to-rose-600 transition shadow-lg hover:shadow-xl animate-pulse"
                >
                  Reveal Identity
                </button>
              ) : (
                <p className="text-gray-500 dark:text-gray-500 text-sm mb-8">
                  Try again with someone new!
                </p>
              )}

              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleBack}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                  Back to Activities
                </button>
                <button
                  onClick={resetSession}
                  className={`px-6 py-3 text-white font-medium rounded-full transition ${
                    mode === 'blind'
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600'
                      : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700'
                  }`}
                >
                  Try Again
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Render CHATTING phase - using real chat components
  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-purple-50/30 to-pink-50/30 dark:from-gray-800/30 dark:to-gray-900/30 relative">
      {/* Background Effects (disabled in blind date mode) */}
      {mode !== 'blind' && backgroundEffect !== 'none' && backgroundVisible && (
        <ChatBackgroundEffects effect={backgroundEffect} visible={backgroundVisible} />
      )}

      {/* Timer Bar */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-b border-purple-100/50 dark:border-gray-700/50 shadow-sm relative z-20">
        <div className="px-6 py-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">TIME REMAINING</span>
              <div className={`px-3 py-1 rounded-full font-mono text-sm font-bold ${
                timeRemaining < 60000
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
                  : timeRemaining < 180000
                    ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
              }`}>
                {formatTime(timeRemaining)}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {mode === 'blind' ? 'Blind Date' : 'Random Chat'}
              </span>
              <button
                onClick={endSession}
                className={`px-3 py-1 text-xs font-medium rounded-full transition ${
                  mode === 'blind'
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-purple-500 hover:bg-purple-600 text-white'
                }`}
              >
                End Chat
              </button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                timeRemaining < 60000 ? 'bg-red-500' : timeRemaining < 180000 ? 'bg-yellow-500' : 'bg-purple-500'
              }`}
              style={{ width: `${(timeRemaining / chatDuration) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Chat Header (hidden in blind date mode) */}
      {displayCharacter && mode !== 'blind' && (
        <div className="relative z-10">
          <ChatHeader
            character={{
              ...displayCharacter,
              name: displayName, // Use display name for blind date
            }}
            characterStatus={mode === 'blind' ? { status: characterStatus?.status, activity: null } : characterStatus}
            characterMood={null}
            characterState={null}
            messages={messages}
            totalMessages={messages.length}
            hasMoreMessages={false}
            onBack={handleBack}
            onUnmatch={() => {}}
            conversationId={conversationId}
            onMoodUpdate={() => {}}
            onStateUpdate={() => {}}
            onCharacterUpdate={() => {}}
            disableSchedule={mode === 'blind'}
          />
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex overflow-hidden gap-4 p-4 relative z-10">
        {/* Left Side - Character Image (hidden in blind date mode) */}
        {displayCharacter && mode !== 'blind' && (
          <div className="relative overflow-hidden rounded-2xl shadow-2xl flex-shrink-0 border border-purple-200/30 dark:border-gray-600/30 w-[320px]">
            <div className="absolute inset-0">
              <img
                src={getCharacterImageUrl() || ''}
                alt={characterName}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-purple-50/20 dark:to-gray-800/30"></div>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10 dark:to-black/30"></div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-32">
              <div className="absolute inset-0 backdrop-blur-sm" style={{
                maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0) 100%)',
                WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0) 100%)'
              }}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-40% via-black/20 to-transparent"></div>
              <div className="absolute bottom-5 left-5 right-5">
                <h2 className="text-xl font-bold text-white drop-shadow-lg">{characterName}</h2>
              </div>
            </div>
          </div>
        )}

        {/* Blind Date Placeholder - Mystery silhouette */}
        {displayCharacter && mode === 'blind' && (
          <div className="relative overflow-hidden rounded-2xl shadow-2xl flex-shrink-0 border border-amber-200/30 dark:border-gray-600/30 w-[320px] bg-gradient-to-br from-gray-800 to-gray-900">
            {/* Mystery pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)'
              }}></div>
            </div>

            {/* Large initial */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-9xl font-bold text-white/20">{characterName.charAt(0).toUpperCase()}</span>
            </div>

            {/* Bottom overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-32">
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-40% via-black/20 to-transparent"></div>
              <div className="absolute bottom-5 left-5 right-5">
                <h2 className="text-xl font-bold text-white drop-shadow-lg">{displayName}</h2>
                <p className="text-sm text-white/60">Identity hidden</p>
              </div>
            </div>
          </div>
        )}

        {/* Right Side - Messages */}
        <div className="flex-1 flex flex-col min-w-0">
          {chatLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <MessageList
              messages={messages}
              character={blindCharacter}
              showTypingIndicator={showTypingIndicator || showTypingIndicatorInternal || waitingForFirstMessage}
              newMessageIds={newMessageIds}
              editingMessageId={editingMessageId}
              editingText={editingText}
              setEditingText={setEditingText}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              onDeleteFrom={handleDeleteFrom}
              messagesEndRef={messagesEndRef}
              imageModalOpen={false}
              setImageModalOpen={() => {}}
              hasMoreMessages={false}
              loadingMore={false}
              onLoadMore={() => {}}
              totalMessages={messages.length}
              onSwipe={handleSwipe}
              onRegenerate={handleRegenerate}
              isRegenerating={isRegenerating}
              messageSwipes={messageSwipes}
              messageSwipeIndex={messageSwipeIndex}
            />
          )}

          {/* Error Display */}
          {error && (
            <div className="px-6 py-2">
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm shadow-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {error}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="relative z-10">
        <ChatInput
          input={input}
          setInput={setInput}
          sending={sending}
          displayingMessages={displayingMessages}
          hasMessages={messages.length > 0}
          characterName={displayName}
          characterId={characterId}
          character={displayCharacter}
          inputRef={inputRef}
          onSend={handleSend}
          onRegenerate={handleRegenerateLast}
          selectedImage={null}
          setSelectedImage={() => {}}
          imageDescription=""
          setImageDescription={() => {}}
          onSuggestReply={handleSuggestReply}
        />
      </div>
    </div>
  );
};

export default ActivityChatSession;
