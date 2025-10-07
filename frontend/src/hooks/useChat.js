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

  useEffect(() => {
    isMountedRef.current = true;
    loadCharacterAndChat();

    return () => {
      isMountedRef.current = false;
    };
  }, [characterId, user?.id]);

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

      // Load conversation and messages
      const { conversation: conv, messages: msgs } = await chatService.getConversation(characterId);
      setConversation(conv);
      setMessages(msgs);

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
  };
};
