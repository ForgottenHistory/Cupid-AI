import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import characterService from '../services/characterService';
import chatService from '../services/chatService';
import api from '../services/api';
import { getCurrentStatusFromSchedule } from '../utils/characterHelpers';

// Cache for activities settings
let settingsCache = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 30000; // 30 seconds

// Chat phases
export const PHASE = {
  IDLE: 'idle',
  LOADING: 'loading',
  CHATTING: 'chatting',
  DECIDING: 'deciding',
  RESULT: 'result',
};

/**
 * New activity session hook that uses real conversations
 * Creates a temporary conversation that gets deleted on no-match or confirmed on match
 */
export const useActivitySession = (user, mode = 'random') => {
  const navigate = useNavigate();

  // Phase state
  const [phase, setPhase] = useState(PHASE.IDLE);
  const [error, setError] = useState(null);

  // Session data from backend
  const [conversationId, setConversationId] = useState(null);
  const [character, setCharacter] = useState(null);
  const [chatDuration, setChatDuration] = useState(10 * 60 * 1000); // Default 10 minutes

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(chatDuration);
  const [startedAt, setStartedAt] = useState(null);
  const timerRef = useRef(null);

  // Decision state
  const [userDecision, setUserDecision] = useState(null);
  const [characterDecision, setCharacterDecision] = useState(null);
  const [characterReason, setCharacterReason] = useState(null);
  const [decidingCharacter, setDecidingCharacter] = useState(false);

  // Proactive message state
  const [proactiveTriggered, setProactiveTriggered] = useState(false);
  const [waitingForProactive, setWaitingForProactive] = useState(false);
  const proactiveTimeoutRef = useRef(null);
  const immediateTimeoutRef = useRef(null);

  // User first chance setting (0-100%)
  const [userFirstChance, setUserFirstChance] = useState(50);

  // Character status (computed from schedule)
  const [characterStatus, setCharacterStatus] = useState({ status: 'online', activity: null });

  // Computed
  const characterName = character?.cardData?.data?.name || character?.cardData?.name || character?.name || 'Character';
  const isMatch = userDecision === 'yes' && characterDecision === 'yes';

  // Update character status periodically
  useEffect(() => {
    const schedule = character?.cardData?.data?.schedule || character?.schedule;
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
    if (phase === PHASE.CHATTING && startedAt) {
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, chatDuration - elapsed);
        setTimeRemaining(remaining);

        if (remaining <= 0) {
          clearInterval(timerRef.current);
          setPhase(PHASE.DECIDING);
        }
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [phase, startedAt, chatDuration]);

  // Track conversation ID in a ref for cleanup
  const conversationIdRef = useRef(null);
  const phaseRef = useRef(phase);
  conversationIdRef.current = conversationId;
  phaseRef.current = phase;

  // Cleanup on unmount only - abandon the conversation if still active
  useEffect(() => {
    return () => {
      if (conversationIdRef.current && phaseRef.current !== PHASE.RESULT) {
        // Fire and forget - abandon the temp conversation
        api.post('/random-chat/abandon', { conversationId: conversationIdRef.current }).catch(() => {});
      }
    };
  }, []); // Empty deps - only runs on unmount

  /**
   * Start a new activity session
   */
  const startSession = useCallback(async () => {
    if (!user?.id) return;

    setPhase(PHASE.LOADING);
    setError(null);

    try {
      // Load activities settings (with cache)
      let settings = settingsCache;
      if (!settings || Date.now() - settingsCacheTime > SETTINGS_CACHE_TTL) {
        const response = await api.get('/users/activities-settings');
        settings = response.data;
        settingsCache = settings;
        settingsCacheTime = Date.now();
      }

      const includeAway = settings?.activitiesIncludeAway || false;
      const includeBusy = settings?.activitiesIncludeBusy || false;
      const userFirst = settings?.activitiesUserFirstChance ?? 50;
      setUserFirstChance(userFirst);

      // Get random online character (respecting settings)
      const selectedCharacter = await characterService.getRandomOnlineCharacter(user.id, includeAway, includeBusy);

      if (!selectedCharacter) {
        setError('No characters available. Make sure you have unmatched characters with schedules that are currently online.');
        setPhase(PHASE.IDLE);
        return;
      }

      // Start activity session - creates temporary conversation
      const response = await api.post('/random-chat/start', {
        characterId: selectedCharacter.id,
        mode: mode
      });

      const { conversationId: convId, chatDuration: duration, startedAt: started } = response.data;

      setConversationId(convId);
      setCharacter(selectedCharacter);
      setChatDuration(duration * 60 * 1000); // Convert minutes to ms
      setStartedAt(new Date(started).getTime());
      setTimeRemaining(duration * 60 * 1000);
      setProactiveTriggered(false);
      setPhase(PHASE.CHATTING);

      console.log(`🎲 Activity session started: conversation ${convId} with ${selectedCharacter.name || 'Character'}`);

    } catch (err) {
      console.error('Failed to start activity session:', err);
      setError(err.response?.data?.error || 'Failed to start session');
      setPhase(PHASE.IDLE);
    }
  }, [user, mode]);

  /**
   * Handle user's match decision
   */
  const handleUserDecision = useCallback(async (decision) => {
    setUserDecision(decision);
    setDecidingCharacter(true);

    try {
      const response = await api.post('/random-chat/decide', {
        conversationId,
        userDecision: decision
      });

      setCharacterDecision(response.data.characterDecision);
      setCharacterReason(response.data.characterReason);
      setDecidingCharacter(false);
      setPhase(PHASE.RESULT);

    } catch (err) {
      console.error('Decision error:', err);
      setError(err.response?.data?.error || 'Failed to get decision');
      setDecidingCharacter(false);
    }
  }, [conversationId]);

  /**
   * Handle match action - confirm and navigate to chat
   */
  const handleMatchAction = useCallback(async () => {
    if (!isMatch || !character) return;

    try {
      // Like the character (if not already liked)
      await characterService.likeCharacter(character.id);

      // Confirm the match - converts temp conversation to permanent
      await api.post('/random-chat/confirm', { conversationId });

      // Navigate to the real chat
      navigate(`/chat/${character.id}`);

    } catch (err) {
      console.error('Match confirmation error:', err);
      setError(err.response?.data?.error || 'Failed to confirm match');
    }
  }, [isMatch, character, conversationId, navigate]);

  /**
   * Reset session for trying again
   */
  const resetSession = useCallback(async () => {
    // Abandon current conversation if exists
    if (conversationId) {
      try {
        await api.post('/random-chat/abandon', { conversationId });
      } catch (err) {
        // Ignore errors - conversation might already be deleted
      }
    }

    // Reset all state
    setPhase(PHASE.IDLE);
    setError(null);
    setConversationId(null);
    setCharacter(null);
    setTimeRemaining(chatDuration);
    setStartedAt(null);
    setUserDecision(null);
    setCharacterDecision(null);
    setCharacterReason(null);
    setDecidingCharacter(false);
    setProactiveTriggered(false);
    setWaitingForProactive(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (proactiveTimeoutRef.current) {
      clearTimeout(proactiveTimeoutRef.current);
    }
    if (immediateTimeoutRef.current) {
      clearTimeout(immediateTimeoutRef.current);
    }
  }, [conversationId, chatDuration]);

  /**
   * Trigger proactive first message from character
   * Called by ActivityChatSession when it detects no messages after a delay
   */
  const triggerProactiveMessage = useCallback(async () => {
    if (!conversationId || !character || proactiveTriggered) {
      return null;
    }

    setProactiveTriggered(true);
    setWaitingForProactive(true);

    try {
      console.log(`🎲 Triggering proactive first message for activity conversation ${conversationId}`);

      const characterData = character.cardData?.data || character.cardData;
      const response = await chatService.generateFirstMessage(character.id, characterData, {
        conversationId,
        activityMode: mode,
      });

      console.log(`🎲 Proactive message generated for activity`);
      return response;
    } catch (err) {
      console.error('Failed to generate proactive message:', err);
      setError('Failed to start conversation');
      return null;
    } finally {
      setWaitingForProactive(false);
    }
  }, [conversationId, character, proactiveTriggered, mode]);

  /**
   * Format time for display
   */
  const formatTime = useCallback((ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Debug: expose end session function
  useEffect(() => {
    const debugEndSession = async (forceMatch = false) => {
      if (phase === PHASE.CHATTING) {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeRemaining(0);

        if (forceMatch && character) {
          console.log('Force matching...');
          try {
            await characterService.likeCharacter(character.id);
            await api.post('/random-chat/confirm', { conversationId });
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
    window.endRandomChat = debugEndSession;
    return () => {
      delete window.endSession;
      delete window.endRandomChat;
    };
  }, [phase, character, conversationId, navigate]);

  return {
    // Phase
    phase,
    error,

    // Session data
    conversationId,
    character,
    characterName,
    characterStatus,
    chatDuration,

    // Timer
    timeRemaining,
    startedAt,
    formatTime,

    // Decision
    userDecision,
    characterDecision,
    characterReason,
    decidingCharacter,
    isMatch,

    // Proactive message
    proactiveTriggered,
    waitingForProactive,
    triggerProactiveMessage,

    // Settings
    userFirstChance,

    // Actions
    startSession,
    handleUserDecision,
    handleMatchAction,
    resetSession,
  };
};
