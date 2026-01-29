import { useState, useEffect, useRef } from 'react';
import characterService from '../services/characterService';
import chatService from '../services/chatService';

/**
 * Hook for managing core chat state and data loading
 * @param {string} characterId - The character ID from URL params
 * @param {Object} user - Current user object
 * @param {number|null} existingConversationId - Optional existing conversation ID (for activity sessions)
 * @returns {Object} Chat state and functions
 */
export const useChat = (characterId, user, existingConversationId = null) => {
  const [character, setCharacter] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [characterStatus, setCharacterStatus] = useState({ status: 'online', activity: null });
  const messagesEndRef = useRef(null);
  const isMountedRef = useRef(true);

  // Pagination state
  const [totalMessages, setTotalMessages] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // All image URLs from the conversation (for rotation display, independent of pagination)
  const [allImageUrls, setAllImageUrls] = useState([]);

  useEffect(() => {
    isMountedRef.current = true;
    loadCharacterAndChat();

    return () => {
      isMountedRef.current = false;
    };
  }, [characterId, user?.id, existingConversationId]);

  // Poll character status every 10 seconds for real-time updates
  useEffect(() => {
    if (!character || !character.cardData?.data?.schedule) return;

    const pollStatus = async () => {
      try {
        const status = await characterService.getCharacterStatus(characterId, character.cardData.data.schedule);
        if (isMountedRef.current) {
          setCharacterStatus(status);
        }
      } catch (err) {
        console.error('Failed to poll status:', err);
      }
    };

    // Poll immediately on mount, then every 10 seconds
    pollStatus();
    const interval = setInterval(pollStatus, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [character, characterId]);

  const loadCharacterAndChat = async () => {
    if (!user?.id || !characterId) return;

    setLoading(true);
    setError('');

    try {
      // Load character and conversation in parallel
      const convPromise = existingConversationId
        ? chatService.getConversationById(existingConversationId, 200, 0)
        : chatService.getConversation(characterId, 200, 0);

      const [char, convData] = await Promise.all([
        characterService.getCharacter(characterId),
        convPromise
      ]);

      if (!char) {
        setError('Character not found');
        return;
      }

      setCharacter(char);

      // Set character status from schedule (no API call needed, computed locally)
      if (char.cardData?.data?.schedule) {
        try {
          const status = await characterService.getCharacterStatus(characterId, char.cardData.data.schedule);
          setCharacterStatus(status);
        } catch (err) {
          console.error('Failed to fetch status:', err);
          setCharacterStatus({ status: 'online', activity: null });
        }
      }

      const { conversation: conv, messages: msgs, total, hasMore, allImageUrls: imageUrls } = convData;
      setConversation(conv);
      setMessages(msgs);
      setTotalMessages(total);
      setHasMoreMessages(hasMore);
      setAllImageUrls(imageUrls || []);

      // Mark messages as read (skip for activity sessions - they're temporary)
      if (msgs.length > 0 && !existingConversationId) {
        chatService.markAsRead(characterId);
        // Notify sidebar to update unread count only (not full reload)
        window.dispatchEvent(new CustomEvent('conversationRead', { detail: { characterId } }));
      }

      // Scroll to bottom after messages are loaded
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      }, 100);
    } catch (err) {
      console.error('Load chat error:', err);
      setError(err.response?.data?.error || 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (loadingMore || !hasMoreMessages) return;

    setLoadingMore(true);
    setError('');

    try {
      // Calculate offset: total messages - currently loaded messages
      const currentOffset = messages.length;
      const { messages: olderMsgs, hasMore } = await chatService.getConversation(characterId, 200, currentOffset);

      if (!isMountedRef.current) return;

      // Prepend older messages to the beginning
      setMessages(prev => [...olderMsgs, ...prev]);
      setHasMoreMessages(hasMore);

      console.log(`📜 Loaded ${olderMsgs.length} more messages (${messages.length + olderMsgs.length}/${totalMessages})`);
    } catch (err) {
      console.error('Load more messages error:', err);
      setError('Failed to load older messages');
    } finally {
      setLoadingMore(false);
    }
  };

  return {
    character,
    setCharacter,
    conversation,
    setConversation,
    messages,
    setMessages,
    loading,
    error,
    setError,
    characterStatus,
    messagesEndRef,
    isMountedRef,
    loadCharacterAndChat,
    // Pagination
    totalMessages,
    hasMoreMessages,
    loadingMore,
    loadMoreMessages,
    // All image URLs for rotation display
    allImageUrls,
    setAllImageUrls,
  };
};
