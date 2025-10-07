import { useState, useEffect, useRef } from 'react';
import socketService from '../services/socketService';
import chatService from '../services/chatService';
import { splitMessageIntoParts } from '../utils/messageUtils';

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

  useEffect(() => {
    if (!user) return;

    // Connect to WebSocket
    socketService.connect(user.id);

    // Listen for new messages
    const handleNewMessage = (data) => {
      if (data.characterId !== characterId) return;

      console.log('📨 Received new message via WebSocket:', data);

      setShowTypingIndicator(false);
      const lastMessage = data.message;

      if (lastMessage && lastMessage.role === 'assistant') {
        // Split AI message by newlines for progressive display
        const messageParts = splitMessageIntoParts(lastMessage.content);

        if (messageParts.length > 1) {
          // Multiple parts - display progressively
          setDisplayingMessages(true);

          // Display each part with a delay
          messageParts.forEach((part, index) => {
            const timeout = setTimeout(() => {
              if (isMountedRef.current && data.characterId === characterId) {
                const partMessageId = `${lastMessage.id}-part-${index}`;
                markMessageAsNew(partMessageId);
                setMessages(prev => [...prev, {
                  ...lastMessage,
                  id: partMessageId,
                  content: part,
                  isLastPart: index === messageParts.length - 1
                }]);

                // On last part, finish up
                if (index === messageParts.length - 1) {
                  setDisplayingMessages(false);
                  setSending(false);
                  inputRef.current?.focus();
                }
              }
            }, index * 800);

            addDisplayTimeout(timeout);
          });
        } else {
          // Single message - display immediately
          markMessageAsNew(lastMessage.id);
          setMessages(prev => [...prev, lastMessage]);
          setSending(false);
          inputRef.current?.focus();
        }
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
      setShowTypingIndicator(true);
    };

    const handleCharacterOffline = (data) => {
      if (data.characterId !== characterId) return;
      console.log('💤 Character is offline');
      setShowTypingIndicator(false);
      setSending(false);
      setError('Character is currently offline');
    };

    const handleAIResponseError = (data) => {
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

    socketService.on('new_message', handleNewMessage);
    socketService.on('character_typing', handleCharacterTyping);
    socketService.on('character_offline', handleCharacterOffline);
    socketService.on('ai_response_error', handleAIResponseError);
    socketService.on('character_unmatched', handleCharacterUnmatched);

    // Cleanup
    return () => {
      socketService.off('new_message', handleNewMessage);
      socketService.off('character_typing', handleCharacterTyping);
      socketService.off('character_offline', handleCharacterOffline);
      socketService.off('ai_response_error', handleAIResponseError);
      socketService.off('character_unmatched', handleCharacterUnmatched);
    };
  }, [user, characterId]);

  return {
    showTypingIndicator,
    setShowTypingIndicator,
    unmatchData,
    setUnmatchData,
  };
};
