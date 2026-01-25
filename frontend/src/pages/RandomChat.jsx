import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import characterService from '../services/characterService';
import api from '../services/api';
import { getImageUrl } from '../services/api';
import { getCurrentStatusFromSchedule } from '../utils/characterHelpers';

// Reuse chat components
import MessageList from '../components/chat/MessageList';
import ChatInput from '../components/chat/ChatInput';
import ChatHeader from '../components/chat/ChatHeader';

// Chat phases
const PHASE = {
  IDLE: 'idle',
  LOADING: 'loading',
  CHATTING: 'chatting',
  DECIDING: 'deciding',
  RESULT: 'result',
};

const CHAT_DURATION = 10 * 60 * 1000; // 10 minutes

const RandomChat = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Phase state
  const [phase, setPhase] = useState(PHASE.IDLE);
  const [error, setError] = useState(null);

  // Character state
  const [character, setCharacter] = useState(null);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);

  // Edit state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');

  // Swipe/regenerate state
  const [messageSwipes, setMessageSwipes] = useState({}); // { messageId: [content1, content2, ...] }
  const [messageSwipeIndex, setMessageSwipeIndex] = useState({}); // { messageId: currentIndex }
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(CHAT_DURATION);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Decision state
  const [userDecision, setUserDecision] = useState(null);
  const [characterDecision, setCharacterDecision] = useState(null);
  const [decidingCharacter, setDecidingCharacter] = useState(false);

  // Session ID
  const [sessionId, setSessionId] = useState(null);

  // Character status (computed from schedule)
  const [characterStatus, setCharacterStatus] = useState({ status: 'online', activity: null });

  // Update character status periodically
  useEffect(() => {
    // Schedule can be in cardData.data.schedule or scheduleData
    const schedule = character?.cardData?.data?.schedule || character?.scheduleData;
    if (!schedule) return;

    const updateStatus = () => {
      const status = getCurrentStatusFromSchedule(schedule);
      setCharacterStatus(status);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [character]);

  // Timer effect
  useEffect(() => {
    if (phase === PHASE.CHATTING && startTimeRef.current) {
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, CHAT_DURATION - elapsed);
        setTimeRemaining(remaining);

        if (remaining <= 0) {
          clearInterval(timerRef.current);
          setPhase(PHASE.DECIDING);
        }
      }, 1000);

      return () => clearInterval(timerRef.current);
    }
  }, [phase]);

  // Format time
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get character name
  const characterName = character?.cardData?.data?.name || character?.cardData?.name || character?.name || 'Character';

  // Get character image URL
  const getCharacterImageUrl = () => {
    if (!character?.imageUrl) return null;
    if (character.imageUrl.startsWith('data:')) return character.imageUrl;
    return getImageUrl(character.imageUrl);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'online': return 'bg-green-400';
      case 'away': return 'bg-yellow-400';
      case 'busy': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  // Start random chat
  const startRandomChat = async () => {
    setPhase(PHASE.LOADING);
    setError(null);

    try {
      const characters = await characterService.getSwipeableCharacters(user.id);

      if (!characters || characters.length === 0) {
        setError('No unmatched characters available. Import more characters to your library!');
        setPhase(PHASE.IDLE);
        return;
      }

      // Filter to only characters with a schedule who are currently online
      const onlineCharacters = characters.filter(char => {
        const schedule = char.cardData?.data?.schedule || char.scheduleData;
        if (!schedule) return false;

        const status = getCurrentStatusFromSchedule(schedule);
        return status.status === 'online';
      });

      if (onlineCharacters.length === 0) {
        setError('No characters are online right now. Try again later or generate schedules for your characters.');
        setPhase(PHASE.IDLE);
        return;
      }

      const randomIndex = Math.floor(Math.random() * onlineCharacters.length);
      const selectedCharacter = onlineCharacters[randomIndex];
      const fullCharacter = await characterService.getCharacter(selectedCharacter.id);

      if (!fullCharacter) {
        setError('Failed to load character data');
        setPhase(PHASE.IDLE);
        return;
      }

      setCharacter(fullCharacter);

      const response = await api.post('/random-chat/start', {
        characterId: fullCharacter.id
      });

      setSessionId(response.data.sessionId);
      setMessages([]);
      setTimeRemaining(CHAT_DURATION);
      startTimeRef.current = Date.now();
      setPhase(PHASE.CHATTING);

      // 50% chance character sends first message immediately
      const characterGoesFirst = Math.random() < 0.5;
      const newSessionId = response.data.sessionId;

      const generateFirstMessage = async () => {
        setShowTypingIndicator(true);
        try {
          const firstMsgResponse = await api.post('/random-chat/first-message', {
            sessionId: newSessionId
          });

          if (firstMsgResponse.data.response) {
            // Split response by newlines into separate messages
            const parts = firstMsgResponse.data.response
              .split('\n')
              .map(p => p.trim())
              .filter(p => p.length > 0);

            if (parts.length > 0) {
              // Add first message immediately
              const firstMsgObj = {
                id: Date.now(),
                role: 'assistant',
                content: parts[0],
                created_at: new Date().toISOString()
              };
              setMessages(prev => prev.length === 0 ? [firstMsgObj] : prev);

              // Add subsequent parts with delays
              for (let i = 1; i < parts.length; i++) {
                await new Promise(resolve => setTimeout(resolve, 800));
                const partMsgObj = {
                  id: Date.now() + i,
                  role: 'assistant',
                  content: parts[i],
                  created_at: new Date().toISOString()
                };
                setMessages(prev => [...prev, partMsgObj]);
              }
            }
          }
        } catch (err) {
          console.error('Failed to generate first message:', err);
        } finally {
          setShowTypingIndicator(false);
          inputRef.current?.focus();
        }
      };

      if (characterGoesFirst) {
        setTimeout(generateFirstMessage, 1000 + Math.random() * 2000); // 1-3 second delay
      } else {
        setTimeout(() => inputRef.current?.focus(), 100);
        // If no messages after 15 seconds, character breaks the ice
        setTimeout(() => {
          setMessages(prev => {
            if (prev.length === 0) {
              generateFirstMessage();
            }
            return prev;
          });
        }, 15000);
      }

    } catch (err) {
      console.error('Failed to start random chat:', err);
      setError('Failed to start random chat. Please try again.');
      setPhase(PHASE.IDLE);
    }
  };

  // Send message
  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || sending || phase !== PHASE.CHATTING) return;

    const userMessage = input.trim();
    setInput('');
    setSending(true);

    // Add user message
    const userMsgObj = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsgObj]);

    setShowTypingIndicator(true);

    try {
      const response = await api.post('/random-chat/message', {
        sessionId,
        message: userMessage
      });

      setShowTypingIndicator(false);

      if (response.data.response) {
        // Split response by newlines into separate messages
        const parts = response.data.response
          .split('\n')
          .map(p => p.trim())
          .filter(p => p.length > 0);

        for (let i = 0; i < parts.length; i++) {
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 800));
          }
          const charMsgObj = {
            id: Date.now() + i + 1,
            role: 'assistant',
            content: parts[i],
            created_at: new Date().toISOString()
          };
          setMessages(prev => [...prev, charMsgObj]);
        }
      }

    } catch (err) {
      console.error('Failed to send message:', err);
      setShowTypingIndicator(false);
    } finally {
      setSending(false);
    }
  };

  // User decision
  const handleUserDecision = async (decision) => {
    setUserDecision(decision);
    setDecidingCharacter(true);

    try {
      const response = await api.post('/random-chat/decide', {
        sessionId,
        userDecision: decision
      });

      setCharacterDecision(response.data.characterDecision);
      setPhase(PHASE.RESULT);

    } catch (err) {
      console.error('Failed to get character decision:', err);
      setError('Failed to get decision. Please try again.');
      setDecidingCharacter(false);
    }
  };

  const isMatch = userDecision === 'yes' && characterDecision === 'yes';

  // Handle match action
  const handleMatchAction = async () => {
    if (isMatch && character) {
      try {
        // Like the character first
        await characterService.likeCharacter(character.id);

        // Convert random chat session to real conversation
        await api.post('/random-chat/convert', { sessionId });

        navigate(`/chat/${character.id}`);
      } catch (err) {
        console.error('Failed to match:', err);
      }
    } else {
      resetChat();
    }
  };

  // Reset
  const resetChat = () => {
    setPhase(PHASE.IDLE);
    setCharacter(null);
    setMessages([]);
    setInput('');
    setUserDecision(null);
    setCharacterDecision(null);
    setDecidingCharacter(false);
    setSessionId(null);
    setTimeRemaining(CHAT_DURATION);
    setError(null);
    setEditingMessageId(null);
    setEditingText('');
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Message editing handlers
  const handleStartEdit = (message) => {
    setEditingMessageId(message.id);
    setEditingText(message.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (messageId) => {
    if (!editingText.trim()) return;

    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, content: editingText.trim() } : msg
    ));
    setEditingMessageId(null);
    setEditingText('');
  };

  // Delete messages from a point onwards (receives index)
  const handleDeleteFrom = async (index) => {
    if (index < 0 || index >= messages.length) return;
    setMessages(prev => prev.slice(0, index));
  };

  // Swipe between alternate responses
  const handleSwipe = (messageId, direction) => {
    const swipes = messageSwipes[messageId];
    if (!swipes || swipes.length <= 1) return;

    const currentIndex = messageSwipeIndex[messageId] || 0;
    let newIndex;

    if (direction === 'left') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : swipes.length - 1;
    } else {
      newIndex = currentIndex < swipes.length - 1 ? currentIndex + 1 : 0;
    }

    setMessageSwipeIndex(prev => ({ ...prev, [messageId]: newIndex }));
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, content: swipes[newIndex] } : msg
    ));
  };

  // Regenerate last assistant message
  const handleRegenerate = async (messageId) => {
    // Find the message and the user message before it
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const targetMsg = messages[msgIndex];
    if (targetMsg.role !== 'assistant') return;

    // Find the last user message before this one
    let userMessage = null;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessage = messages[i];
        break;
      }
    }

    if (!userMessage) return;

    setIsRegenerating(true);

    try {
      const response = await api.post('/random-chat/message', {
        sessionId,
        message: userMessage.content,
        regenerate: true
      });

      if (response.data.response) {
        const newContent = response.data.response;

        // Add to swipes for this message
        const existingSwipes = messageSwipes[messageId] || [targetMsg.content];
        if (!existingSwipes.includes(newContent)) {
          const newSwipes = [...existingSwipes, newContent];
          setMessageSwipes(prev => ({ ...prev, [messageId]: newSwipes }));
          setMessageSwipeIndex(prev => ({ ...prev, [messageId]: newSwipes.length - 1 }));
        }

        // Update the message content
        setMessages(prev => prev.map(msg =>
          msg.id === messageId ? { ...msg, content: newContent } : msg
        ));
      }
    } catch (err) {
      console.error('Failed to regenerate:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Suggest reply handler for random chat
  const handleSuggestReply = async (style) => {
    const response = await api.post('/random-chat/suggest-reply', {
      sessionId,
      style
    });
    return response.data.suggestion;
  };

  // Debug: expose function to trigger end mechanic from console
  useEffect(() => {
    window.endRandomChat = async (forceMatch = false) => {
      if (phase === PHASE.CHATTING) {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeRemaining(0);

        if (forceMatch) {
          // Skip deciding phase, force a match and convert to real chat
          console.log('🎲 Force matching and converting to real chat...');
          try {
            await characterService.likeCharacter(character.id);
            await api.post('/random-chat/convert', { sessionId, forceMatch: true });
            console.log('🎲 Converted! Navigating to chat...');
            navigate(`/chat/${character.id}`);
          } catch (err) {
            console.error('🎲 Force match failed:', err);
          }
        } else {
          setPhase(PHASE.DECIDING);
          console.log('🎲 Random chat ended early via debug');
        }
      } else {
        console.log('🎲 Not in chatting phase, current phase:', phase);
      }
    };
    return () => { delete window.endRandomChat; };
  }, [phase, character, sessionId, navigate]);

  // Render IDLE phase
  if (phase === PHASE.IDLE) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Random Chat
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Chat with a random character for 10 minutes. At the end, both of you decide whether to match. If you both say yes, it's a match!
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={startRandomChat}
            className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-full hover:from-pink-600 hover:to-purple-700 transition shadow-lg hover:shadow-xl"
          >
            Start Random Chat
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
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="text-center max-w-md">
          {getCharacterImageUrl() && (
            <img
              src={getCharacterImageUrl()}
              alt={characterName}
              className="w-32 h-32 rounded-full object-cover mx-auto mb-6 ring-4 ring-purple-500 shadow-xl"
            />
          )}

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Time's Up!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your chat with <span className="font-medium text-purple-600 dark:text-purple-400">{characterName}</span> has ended.
            Would you like to match with them?
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
                className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-medium rounded-full hover:from-pink-600 hover:to-purple-700 transition"
              >
                Match!
              </button>
            </div>
          )}

          {decidingCharacter && !characterDecision && (
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
              <p className="text-gray-600 dark:text-gray-400">
                {characterName} is deciding...
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render RESULT phase
  if (phase === PHASE.RESULT) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="text-center max-w-md">
          {isMatch ? (
            <>
              <div className="relative mb-8">
                <div className="w-32 h-32 mx-auto relative">
                  {getCharacterImageUrl() && (
                    <img
                      src={getCharacterImageUrl()}
                      alt={characterName}
                      className="w-32 h-32 rounded-full object-cover ring-4 ring-pink-500 animate-pulse shadow-xl"
                    />
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
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                You and {characterName} both wanted to connect!
              </p>

              <button
                onClick={handleMatchAction}
                className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-full hover:from-pink-600 hover:to-purple-700 transition shadow-lg hover:shadow-xl"
              >
                Start Chatting
              </button>
            </>
          ) : (
            <>
              {getCharacterImageUrl() && (
                <img
                  src={getCharacterImageUrl()}
                  alt={characterName}
                  className="w-32 h-32 rounded-full object-cover mx-auto mb-6 opacity-50 grayscale"
                />
              )}

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                No Match
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                {userDecision === 'no' && characterDecision === 'no' && "Neither of you wanted to match. That's okay!"}
                {userDecision === 'yes' && characterDecision === 'no' && `${characterName} wasn't feeling it this time.`}
                {userDecision === 'no' && characterDecision === 'yes' && `${characterName} wanted to match, but you passed.`}
              </p>
              <p className="text-gray-500 dark:text-gray-500 text-sm mb-8">
                Try again with someone new!
              </p>

              <button
                onClick={resetChat}
                className="px-8 py-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Render CHATTING phase - match Chat.jsx layout exactly
  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-purple-50/30 to-pink-50/30 dark:from-gray-800/30 dark:to-gray-900/30 relative">
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
            <div className="text-xs text-gray-400 dark:text-gray-500">
              Random Chat
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                timeRemaining < 60000 ? 'bg-red-500' : timeRemaining < 180000 ? 'bg-yellow-500' : 'bg-purple-500'
              }`}
              style={{ width: `${(timeRemaining / CHAT_DURATION) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Chat Header */}
      {character && (
        <div className="relative z-10">
          <ChatHeader
            character={character}
            characterStatus={characterStatus}
            characterMood={null}
            characterState={null}
            messages={messages}
            totalMessages={messages.length}
            hasMoreMessages={false}
            onBack={() => resetChat()}
            onUnmatch={() => {}}
            conversationId={null}
            onMoodUpdate={() => {}}
            onStateUpdate={() => {}}
            onCharacterUpdate={() => {}}
          />
        </div>
      )}

      {/* Main Chat Area - Split view like Chat.jsx */}
      <div className="flex-1 flex overflow-hidden gap-4 p-4 relative z-10">
        {/* Left Side - Character Image */}
        {character && (
          <div className="relative overflow-hidden rounded-2xl shadow-2xl flex-shrink-0 border border-purple-200/30 dark:border-gray-600/30 w-[320px]">
            {/* Image */}
            <div className="absolute inset-0">
              <img
                src={getCharacterImageUrl() || ''}
                alt={characterName}
                className="w-full h-full object-cover object-center"
              />
              {/* Gradient overlays */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-purple-50/20 dark:to-gray-800/30"></div>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10 dark:to-black/30"></div>
            </div>

            {/* Character name overlay at bottom */}
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

        {/* Right Side - Messages */}
        <div className="flex-1 flex flex-col min-w-0">
          <MessageList
            messages={messages}
            character={character}
            showTypingIndicator={showTypingIndicator}
            newMessageIds={new Set()}
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
        </div>
      </div>

      {/* Input */}
      <div className="relative z-10">
        <ChatInput
          input={input}
          setInput={setInput}
          sending={sending}
          displayingMessages={false}
          hasMessages={messages.length > 0}
          characterName={characterName}
          characterId={character?.id}
          character={character}
          inputRef={inputRef}
          onSend={handleSend}
          onRegenerate={() => {}}
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

export default RandomChat;
