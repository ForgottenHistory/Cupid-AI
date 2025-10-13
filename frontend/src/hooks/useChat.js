import { useState, useEffect, useRef } from 'react';
import characterService from '../services/characterService';
import chatService from '../services/chatService';

/**
 * Hook for managing core chat state and data loading
 * @param {string} characterId - The character ID from URL params
 * @param {Object} user - Current user object
 * @returns {Object} Chat state and functions
 */
export const useChat = (characterId, user) => {
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

  useEffect(() => {
    isMountedRef.current = true;
    loadCharacterAndChat();

    return () => {
      isMountedRef.current = false;
    };
  }, [characterId, user?.id]);

  // Poll character status every 10 seconds for real-time updates
  useEffect(() => {
    if (!character || !character.cardData?.data?.schedule) return;

    const pollStatus = async () => {
      try {
        const status = await characterService.getCharacterStatus(characterId, character.cardData.data.schedule);
        if (isMountedRef.current) {
          // Only log if status actually changed
          if (status.status !== characterStatus.status || status.activity !== characterStatus.activity) {
            console.log(`📊 Status updated: ${status.status}${status.activity ? ` - ${status.activity}` : ''}`);
          }
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
      // Load character from IndexedDB
      const characters = await characterService.getAllCharacters(user.id);
      const char = characters.find(c => c.id === characterId);

      if (!char) {
        setError('Character not found');
        return;
      }

      setCharacter(char);

      // Fetch character status if schedule exists
      if (char.cardData?.data?.schedule) {
        try {
          const status = await characterService.getCharacterStatus(characterId, char.cardData.data.schedule);
          setCharacterStatus(status);
        } catch (err) {
          console.error('Failed to fetch status:', err);
          // Default to online if status fetch fails
          setCharacterStatus({ status: 'online', activity: null });
        }
      }

      // Load conversation and messages (latest 200 by default)
      const { conversation: conv, messages: msgs, total, hasMore } = await chatService.getConversation(characterId, 200, 0);
      setConversation(conv);
      setMessages(msgs);
      setTotalMessages(total);
      setHasMoreMessages(hasMore);

      // Mark messages as read
      if (msgs.length > 0) {
        await chatService.markAsRead(characterId);
        // Notify sidebar to refresh
        window.dispatchEvent(new Event('characterUpdated'));
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
  };
};
