import { useState, useEffect, useRef } from 'react';
import socketService from '../services/socketService';
import chatService from '../services/chatService';
import { useMood } from '../context/MoodContext';

/**
 * Hook for managing WebSocket connection and real-time message handling
 * @param {string} characterId - Current character ID
 * @param {Object} user - Current user object
 * @param {Object} isMountedRef - Ref to track component mount status
 * @param {Function} setMessages - Function to update messages state
 * @param {Function} setSending - Function to update sending state
 * @param {Function} setError - Function to update error state
 * @param {Function} markMessageAsNew - Function to mark message as new for animation
 * @param {Function} setDisplayingMessages - Function to set displaying messages state
 * @param {Function} addDisplayTimeout - Function to add timeout to cleanup array
 * @param {Object} inputRef - Ref to input element for focus
 * @returns {Object} WebSocket state
 */
export const useChatWebSocket = ({
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
  onCharacterMoodUpdate,
}) => {
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const [unmatchData, setUnmatchData] = useState(null);
  const [currentThought, setCurrentThought] = useState(null);
  const [isCompacting, setIsCompacting] = useState(false);
  const [characterMood, setCharacterMood] = useState(null);
  const { setMoodEffect, clearMoodEffect, closeMoodModal } = useMood();

  // Use ref to track current characterId to prevent stale closures
  const currentCharacterIdRef = useRef(characterId);

  // Helper to clear typing indicator
  const clearTypingIndicator = () => {
    setShowTypingIndicator(false);
  };

  // Check pending request status from server when characterId changes
  useEffect(() => {
    // Update ref with current characterId
    currentCharacterIdRef.current = characterId;

    console.log('🔄 Character changed to:', characterId);

    // Clear thought when switching characters
    setCurrentThought(null);

    // Query server for actual pending status (authoritative source)
    if (characterId) {
      chatService.checkPending(characterId)
        .then(({ pending }) => {
          console.log(`🔄 Server pending status for ${characterId}: ${pending}`);
          setShowTypingIndicator(pending);
          if (pending) {
            socketService.setTyping(characterId, true);
          } else {
            socketService.clearTyping(characterId);
          }
        })
        .catch(err => {
          console.error('Failed to check pending status:', err);
          // Fall back to client-side state on error
          const isTyping = socketService.isTyping(characterId);
          setShowTypingIndicator(isTyping);
        });
    }
  }, [characterId]);

  // Listen for test events from debug functions
  useEffect(() => {
    const handleTestCompactingStart = (event) => {
      if (event.detail.characterId === characterId) {
        console.log('🎬 [TEST] Compacting UI started');
        setIsCompacting(true);
      }
    };

    const handleTestCompactingEnd = (event) => {
      if (event.detail.characterId === characterId) {
        console.log('🎬 [TEST] Compacting UI ended');
        setIsCompacting(false);
      }
    };

    window.addEventListener('test_compacting_start', handleTestCompactingStart);
    window.addEventListener('test_compacting_end', handleTestCompactingEnd);

    return () => {
      window.removeEventListener('test_compacting_start', handleTestCompactingStart);
      window.removeEventListener('test_compacting_end', handleTestCompactingEnd);
    };
  }, [characterId]);

  useEffect(() => {
    if (!user) return;

    // Connect to WebSocket
    socketService.connect(user.id);

    // Listen for new messages
    const handleNewMessage = (data) => {
      // Clear typing state globally for ANY character (not just current one)
      socketService.clearTyping(data.characterId);

      console.log('📨 Received new message via WebSocket:', data);

      // If message is from a DIFFERENT character, refresh sidebar immediately
      // Use ref to get the CURRENT characterId, not the one from when handler was created
      if (data.characterId !== currentCharacterIdRef.current) {
        console.log(`📨 Message from different character (${data.characterId} vs current ${currentCharacterIdRef.current}) - ignoring`);
        window.dispatchEvent(new Event('characterUpdated'));
        return;
      }

      // If we're here, this is the current character
      clearTypingIndicator();
      const lastMessage = data.message;

      // Check for 30-minute time gap and clear mood effects if needed
      setMessages(prev => {
        if (prev.length > 0) {
          // Find last non-system message (user or assistant)
          const lastNonSystemMsg = [...prev].reverse().find(m => m.role !== 'system');

          if (lastNonSystemMsg) {
            const lastMsgTime = new Date(lastNonSystemMsg.created_at).getTime();
            const newMsgTime = new Date(lastMessage.created_at).getTime();
            const gapMinutes = (newMsgTime - lastMsgTime) / (1000 * 60);

            if (gapMinutes >= 30) {
              console.log(`⏰ Time gap of ${gapMinutes.toFixed(1)} minutes detected - clearing mood effects`);
              clearMoodEffect(currentCharacterIdRef.current);
            }
          }
        }
        return prev; // Don't actually modify messages yet
      });

      if (lastMessage && lastMessage.role === 'assistant') {
        // Messages are now split on the backend - just display immediately
        markMessageAsNew(lastMessage.id);
        setMessages(prev => {
          const newMessages = [...prev, lastMessage];
          // Check if sorting is needed (only if new message is out of order)
          const needsSorting = prev.length > 0 &&
            new Date(lastMessage.created_at) < new Date(prev[prev.length - 1].created_at);

          // Only sort if necessary to avoid unnecessary re-renders
          return needsSorting
            ? newMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            : newMessages;
        });
        setSending(false);
        inputRef.current?.focus();
      }

      // Mark messages as read since user is actively viewing this chat
      // Do this BEFORE refreshing sidebar so unread count is correct
      chatService.markAsRead(currentCharacterIdRef.current).then(() => {
        // Refresh sidebar after marking as read
        window.dispatchEvent(new Event('characterUpdated'));
      }).catch(err => {
        console.error('Failed to mark messages as read:', err);
        // Still refresh sidebar even if markAsRead fails
        window.dispatchEvent(new Event('characterUpdated'));
      });
    };

    const handleCharacterTyping = (data) => {
      if (data.characterId !== currentCharacterIdRef.current) return;
      console.log('⌨️  Character is typing...');

      // Store typing state globally
      socketService.setTyping(data.characterId, true);
      setShowTypingIndicator(true);
    };

    const handleCharacterOffline = (data) => {
      // Clear typing state globally for ANY character (not just current one)
      socketService.clearTyping(data.characterId);

      // Only update UI if this is the current character
      if (data.characterId !== currentCharacterIdRef.current) return;
      console.log('💤 Character is offline');

      clearTypingIndicator();
      setSending(false);
      setError('Character is currently offline');
    };

    const handleNoResponse = (data) => {
      // Clear typing state globally for ANY character (not just current one)
      socketService.clearTyping(data.characterId);

      // Only update UI if this is the current character
      if (data.characterId !== currentCharacterIdRef.current) return;
      console.log('🤷 Character chose not to respond');

      clearTypingIndicator();
      setSending(false);
      // No error message - this is intentional behavior
    };

    const handleAIResponseError = (data) => {
      // Clear typing state globally for ANY character (not just current one)
      socketService.clearTyping(data.characterId);

      // Only update UI if this is the current character
      if (data.characterId !== currentCharacterIdRef.current) return;
      console.error('❌ AI response error:', data.error);

      clearTypingIndicator();
      setSending(false);
      setError(data.error || 'Failed to generate response');
    };

    const handleCharacterUnmatched = async (data) => {
      console.log('💔 Character has unmatched:', data);

      // Delete character from IndexedDB (do this regardless of which chat we're viewing)
      try {
        const characterService = (await import('../services/characterService')).default;
        // Use deleteCharacter instead of unlikeCharacter to fully remove from IndexedDB
        await characterService.deleteCharacter(data.characterId);

        // Notify other components to refresh
        window.dispatchEvent(new Event('characterUpdated'));

        // Only show unmatch modal if we're currently viewing this character's chat
        if (data.characterId === currentCharacterIdRef.current) {
          setUnmatchData({
            characterId: data.characterId,
            characterName: data.characterName,
            reason: data.reason
          });
        }
      } catch (error) {
        console.error('Failed to handle unmatch:', error);
      }
    };

    const handleMoodChange = (data) => {
      // Only update UI if this is the current character
      if (data.characterId !== currentCharacterIdRef.current) return;

      console.log('🎨 Mood change received:', data);

      // Set mood visual effects for this character with 30 minute auto-clear
      setMoodEffect(data.characterId, data.mood, data.characterName, 30 * 60 * 1000);

      // Auto-close the modal after 3 seconds (background effect persists)
      setTimeout(() => {
        closeMoodModal(data.characterId);
      }, 3000);

      // Add system message to chat if systemMessage is provided
      if (data.systemMessage) {
        const systemMsg = {
          id: data.messageId || `system-${Date.now()}`,
          role: 'system',
          content: data.systemMessage,
          created_at: new Date().toISOString(), // Already in UTC format with Z
        };

        setMessages(prev => [...prev, systemMsg]);
      }
    };

    const handleCharacterThought = (data) => {
      // Only update UI if this is the current character
      if (data.characterId !== currentCharacterIdRef.current) return;

      console.log('💭 Thought received:', data.thought);

      // Set thought (will auto-fade after a few seconds)
      setCurrentThought(data.thought);

      // Auto-clear thought after 8 seconds
      setTimeout(() => {
        setCurrentThought(null);
      }, 8000);
    };

    const handleCompactingStart = (data) => {
      // Only show compacting UI if this is the current character
      if (data.characterId !== currentCharacterIdRef.current) return;

      console.log('🗜️ Compacting started for character:', data.characterId);
      setIsCompacting(true);
    };

    const handleCompactingEnd = (data) => {
      // Only update UI if this is the current character
      if (data.characterId !== currentCharacterIdRef.current) return;

      console.log('✅ Compacting finished for character:', data.characterId);
      setIsCompacting(false);
    };

    const handleMessagesCombined = (data) => {
      // Only update UI if this is the current character
      if (data.characterId !== currentCharacterIdRef.current) return;

      console.log('🔗 TIME GAPs combined:', data);

      // Remove deleted messages and update the combined one
      setMessages(prev => {
        let updated = prev.filter(msg => !data.deletedIds.includes(msg.id));

        // Update the combined message if provided
        if (data.updatedMessage) {
          updated = updated.map(msg =>
            msg.id === data.updatedMessage.id ? data.updatedMessage : msg
          );
        }

        return updated;
      });
    };

    const handleCharacterMoodUpdate = (data) => {
      // Only update UI if this is the current character
      if (data.characterId !== currentCharacterIdRef.current) return;

      console.log('🎭 Character mood update received:', data.mood);

      // Update local state
      setCharacterMood(data.mood);

      // Call callback if provided
      if (onCharacterMoodUpdate) {
        onCharacterMoodUpdate(data.mood);
      }
    };

    socketService.on('new_message', handleNewMessage);
    socketService.on('character_typing', handleCharacterTyping);
    socketService.on('character_offline', handleCharacterOffline);
    socketService.on('no_response', handleNoResponse);
    socketService.on('ai_response_error', handleAIResponseError);
    socketService.on('character_unmatched', handleCharacterUnmatched);
    socketService.on('mood_change', handleMoodChange);
    socketService.on('character_thought', handleCharacterThought);
    socketService.on('compacting_start', handleCompactingStart);
    socketService.on('compacting_end', handleCompactingEnd);
    socketService.on('messages_combined', handleMessagesCombined);
    socketService.on('character_mood_update', handleCharacterMoodUpdate);

    // Cleanup
    return () => {
      socketService.off('new_message', handleNewMessage);
      socketService.off('character_typing', handleCharacterTyping);
      socketService.off('character_offline', handleCharacterOffline);
      socketService.off('no_response', handleNoResponse);
      socketService.off('ai_response_error', handleAIResponseError);
      socketService.off('character_unmatched', handleCharacterUnmatched);
      socketService.off('mood_change', handleMoodChange);
      socketService.off('character_thought', handleCharacterThought);
      socketService.off('compacting_start', handleCompactingStart);
      socketService.off('compacting_end', handleCompactingEnd);
      socketService.off('messages_combined', handleMessagesCombined);
      socketService.off('character_mood_update', handleCharacterMoodUpdate);
    };
  }, [user, characterId, setMoodEffect, closeMoodModal, onCharacterMoodUpdate]);

  return {
    showTypingIndicator,
    setShowTypingIndicator,
    unmatchData,
    setUnmatchData,
    currentThought,
    isCompacting,
    characterMood,
    setCharacterMood,
  };
};
