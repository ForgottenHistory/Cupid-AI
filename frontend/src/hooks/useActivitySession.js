import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import characterService from '../services/characterService';
import api from '../services/api';
import { getCurrentStatusFromSchedule } from '../utils/characterHelpers';

// Chat phases
export const PHASE = {
  IDLE: 'idle',
  LOADING: 'loading',
  CHATTING: 'chatting',
  DECIDING: 'deciding',
  RESULT: 'result',
};

export const CHAT_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Shared hook for Random Chat and Blind Date sessions
 * Handles all chat state, messaging, and decision logic
 */
export const useActivitySession = (user, mode = 'random') => {
  const navigate = useNavigate();
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

  // Auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Edit state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');

  // Swipe/regenerate state
  const [messageSwipes, setMessageSwipes] = useState({});
  const [messageSwipeIndex, setMessageSwipeIndex] = useState({});
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(CHAT_DURATION);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Decision state
  const [userDecision, setUserDecision] = useState(null);
  const [characterDecision, setCharacterDecision] = useState(null);
  const [characterReason, setCharacterReason] = useState(null);
  const [decidingCharacter, setDecidingCharacter] = useState(false);

  // Session ID
  const [sessionId, setSessionId] = useState(null);

  // Character status (computed from schedule)
  const [characterStatus, setCharacterStatus] = useState({ status: 'online', activity: null });

  // Update character status periodically
  useEffect(() => {
    const schedule = character?.cardData?.data?.schedule || character?.scheduleData;
    if (!schedule) return;

    const updateStatus = () => {
      const status = getCurrentStatusFromSchedule(schedule);
      setCharacterStatus(status);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 60000);
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

  // Start session
  const startSession = async () => {
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
        characterId: fullCharacter.id,
        mode: mode
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
            const parts = firstMsgResponse.data.response
              .split('\n')
              .map(p => p.trim())
              .filter(p => p.length > 0);

            if (parts.length > 0) {
              const firstMsgObj = {
                id: Date.now(),
                role: 'assistant',
                content: parts[0],
                created_at: new Date().toISOString()
              };
              setMessages(prev => prev.length === 0 ? [firstMsgObj] : prev);

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
        setTimeout(generateFirstMessage, 1000 + Math.random() * 2000);
      } else {
        setTimeout(() => inputRef.current?.focus(), 100);
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
      console.error('Failed to start session:', err);
      setError('Failed to start. Please try again.');
      setPhase(PHASE.IDLE);
    }
  };

  // Send message
  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (sending || phase !== PHASE.CHATTING) return;

    const userMessage = input.trim();
    setInput('');
    setSending(true);
    setError(null);

    // If there's a user message, add it to the chat
    if (userMessage) {
      const userMsgObj = {
        id: Date.now(),
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMsgObj]);
    }

    // Random delay before showing typing indicator (500-2000ms)
    const typingDelay = Math.random() * 1500 + 500;
    const typingTimeout = setTimeout(() => {
      setShowTypingIndicator(true);
    }, typingDelay);

    try {
      const response = await api.post('/random-chat/message', {
        sessionId,
        message: userMessage
      });

      clearTimeout(typingTimeout);
      setShowTypingIndicator(false);

      if (response.data.response) {
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
      clearTimeout(typingTimeout);
      setShowTypingIndicator(false);
      setError(err.response?.data?.error || 'Failed to get response. Please try again.');
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
      setCharacterReason(response.data.characterReason);
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
        await characterService.likeCharacter(character.id);
        await api.post('/random-chat/convert', { sessionId });
        navigate(`/chat/${character.id}`);
      } catch (err) {
        console.error('Failed to match:', err);
      }
    } else {
      resetSession();
    }
  };

  // Reset
  const resetSession = () => {
    setPhase(PHASE.IDLE);
    setCharacter(null);
    setMessages([]);
    setInput('');
    setUserDecision(null);
    setCharacterDecision(null);
    setCharacterReason(null);
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

  // Delete messages from a point onwards
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
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const targetMsg = messages[msgIndex];
    if (targetMsg.role !== 'assistant') return;

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
        const existingSwipes = messageSwipes[messageId] || [targetMsg.content];
        if (!existingSwipes.includes(newContent)) {
          const newSwipes = [...existingSwipes, newContent];
          setMessageSwipes(prev => ({ ...prev, [messageId]: newSwipes }));
          setMessageSwipeIndex(prev => ({ ...prev, [messageId]: newSwipes.length - 1 }));
        }
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

  // Suggest reply handler
  const handleSuggestReply = async (style) => {
    const response = await api.post('/random-chat/suggest-reply', {
      sessionId,
      style
    });
    return response.data.suggestion;
  };

  // Debug: expose function to trigger end mechanic
  useEffect(() => {
    const debugEndSession = async (forceMatch = false) => {
      if (phase === PHASE.CHATTING) {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeRemaining(0);

        if (forceMatch) {
          console.log('Force matching and converting to real chat...');
          try {
            await characterService.likeCharacter(character.id);
            await api.post('/random-chat/convert', { sessionId, forceMatch: true });
            console.log('Converted! Navigating to chat...');
            navigate(`/chat/${character.id}`);
          } catch (err) {
            console.error('Force match failed:', err);
          }
        } else {
          setPhase(PHASE.DECIDING);
          console.log('Session ended early via debug');
        }
      } else {
        console.log('Not in chatting phase, current phase:', phase);
      }
    };
    window.endSession = debugEndSession;
    window.endRandomChat = debugEndSession; // Alias for backwards compatibility
    return () => {
      delete window.endSession;
      delete window.endRandomChat;
    };
  }, [phase, character, sessionId, navigate]);

  return {
    // Refs
    inputRef,
    messagesEndRef,

    // State
    phase,
    error,
    character,
    messages,
    input,
    setInput,
    sending,
    showTypingIndicator,
    editingMessageId,
    editingText,
    setEditingText,
    messageSwipes,
    messageSwipeIndex,
    isRegenerating,
    timeRemaining,
    userDecision,
    characterDecision,
    characterReason,
    decidingCharacter,
    characterStatus,
    characterName,
    isMatch,

    // Handlers
    startSession,
    handleSend,
    handleUserDecision,
    handleMatchAction,
    resetSession,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleDeleteFrom,
    handleSwipe,
    handleRegenerate,
    handleSuggestReply,
    formatTime,

    // Constants
    CHAT_DURATION,
  };
};
