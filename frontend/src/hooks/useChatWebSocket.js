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
}) => {
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const [unmatchData, setUnmatchData] = useState(null);
  const { setMoodEffect, clearMoodEffect } = useMood();

  // Check if character is currently typing when characterId changes
  useEffect(() => {
    console.log('🔄 Character changed to:', characterId);
    const isTyping = characterId && socketService.isTyping(characterId);
    setShowTypingIndicator(isTyping);
    console.log(`🔄 Set typing indicator to: ${isTyping} for character ${characterId}`);

    if (isTyping) {
      console.log('⌨️  Restoring typing indicator for character:', characterId);
    }
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
      if (data.characterId !== characterId) {
        window.dispatchEvent(new Event('characterUpdated'));
        return;
      }

      // If we're here, this is the current character
      setShowTypingIndicator(false);
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
              clearMoodEffect(characterId);
            }
          }
        }
        return prev; // Don't actually modify messages yet
      });

      if (lastMessage && lastMessage.role === 'assistant') {
        // Messages are now split on the backend - just display immediately
        markMessageAsNew(lastMessage.id);
        setMessages(prev => [...prev, lastMessage]);
        setSending(false);
        inputRef.current?.focus();
      }

      // Mark messages as read since user is actively viewing this chat
      // Do this BEFORE refreshing sidebar so unread count is correct
      chatService.markAsRead(characterId).then(() => {
        // Refresh sidebar after marking as read
        window.dispatchEvent(new Event('characterUpdated'));
      }).catch(err => {
        console.error('Failed to mark messages as read:', err);
        // Still refresh sidebar even if markAsRead fails
        window.dispatchEvent(new Event('characterUpdated'));
      });
    };

    const handleCharacterTyping = (data) => {
      if (data.characterId !== characterId) return;
      console.log('⌨️  Character is typing...');

      // Store typing state globally
      socketService.setTyping(data.characterId, true);
      setShowTypingIndicator(true);
    };

    const handleCharacterOffline = (data) => {
      // Clear typing state globally for ANY character (not just current one)
      socketService.clearTyping(data.characterId);

      // Only update UI if this is the current character
      if (data.characterId !== characterId) return;
      console.log('💤 Character is offline');

      setShowTypingIndicator(false);
      setSending(false);
      setError('Character is currently offline');
    };

    const handleAIResponseError = (data) => {
      // Clear typing state globally for ANY character (not just current one)
      socketService.clearTyping(data.characterId);

      // Only update UI if this is the current character
      if (data.characterId !== characterId) return;
      console.error('❌ AI response error:', data.error);

      setShowTypingIndicator(false);
      setSending(false);
      setError(data.error || 'Failed to generate response');
    };

    const handleCharacterUnmatched = async (data) => {
      if (data.characterId !== characterId) return;
      console.log('💔 Character has unmatched:', data);

      // Unlike character in IndexedDB
      try {
        const characterService = (await import('../services/characterService')).default;
        await characterService.unlikeCharacter(data.characterId);

        // Notify other components to refresh
        window.dispatchEvent(new Event('characterUpdated'));

        // Set unmatch data to trigger modal display
        setUnmatchData({
          characterId: data.characterId,
          characterName: data.characterName,
          reason: data.reason
        });
      } catch (error) {
        console.error('Failed to handle unmatch:', error);
      }
    };

    const handleMoodChange = (data) => {
      // Only update UI if this is the current character
      if (data.characterId !== characterId) return;

      console.log('🎨 Mood change received:', data);

      // Set mood visual effects for this character with 30 minute auto-clear
      setMoodEffect(data.characterId, data.mood, data.characterName, 30 * 60 * 1000);

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

    socketService.on('new_message', handleNewMessage);
    socketService.on('character_typing', handleCharacterTyping);
    socketService.on('character_offline', handleCharacterOffline);
    socketService.on('ai_response_error', handleAIResponseError);
    socketService.on('character_unmatched', handleCharacterUnmatched);
    socketService.on('mood_change', handleMoodChange);

    // Cleanup
    return () => {
      socketService.off('new_message', handleNewMessage);
      socketService.off('character_typing', handleCharacterTyping);
      socketService.off('character_offline', handleCharacterOffline);
      socketService.off('ai_response_error', handleAIResponseError);
      socketService.off('character_unmatched', handleCharacterUnmatched);
      socketService.off('mood_change', handleMoodChange);
    };
  }, [user, characterId, setMoodEffect]);

  return {
    showTypingIndicator,
    setShowTypingIndicator,
    unmatchData,
    setUnmatchData,
  };
};
