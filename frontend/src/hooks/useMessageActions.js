import { useState, useRef } from 'react';
import chatService from '../services/chatService';
import { extractActualMessageId, splitMessageIntoParts } from '../utils/messageUtils';

/**
 * Hook for managing message actions (send, regenerate, edit, delete)
 * @param {Object} params - Hook parameters
 * @returns {Object} Message action handlers and state
 */
export const useMessageActions = ({
  characterId,
  character,
  messages,
  setMessages,
  setConversation,
  setError,
  isMountedRef,
  markMessageAsNew,
  setDisplayingMessages,
  addDisplayTimeout,
  inputRef,
}) => {
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [showTypingIndicatorInternal, setShowTypingIndicatorInternal] = useState(false);

  /**
   * Send a new message
   */
  const handleSend = async (e) => {
    e.preventDefault();

    if (sending) return;

    const userMessage = input.trim();
    const currentCharacterId = characterId; // Capture current character ID
    setInput('');
    setSending(true);
    setError('');

    // If empty message, skip adding user message and just prompt AI to continue
    if (!userMessage) {
      try {
        // Just trigger AI response without user message
        await chatService.sendMessage(
          currentCharacterId,
          '', // Empty message triggers AI to continue
          character.cardData.data
        );
        // WebSocket will handle the AI response
      } catch (err) {
        console.error('Send empty message error:', err);
        if (currentCharacterId === characterId) {
          setError(err.response?.data?.error || 'Failed to prompt AI');
          setSending(false);
        }
      }
      return;
    }

    // Optimistically add user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };

    markMessageAsNew(tempUserMsg.id);
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      // Send message to backend (returns immediately)
      const response = await chatService.sendMessage(
        currentCharacterId,
        userMessage,
        character.cardData.data
      );

      // Update with saved user message
      if (isMountedRef.current && currentCharacterId === characterId && response.message) {
        setMessages(prev => {
          // Replace temp message with real saved message
          return prev.map(m => m.id === tempUserMsg.id ? response.message : m);
        });
      }

      // WebSocket will handle the AI response asynchronously
      // Typing indicator and response will come via WebSocket events

    } catch (err) {
      console.error('Send message error:', err);
      // Only show error if still viewing the same character
      if (currentCharacterId === characterId) {
        setError(err.response?.data?.error || 'Failed to send message');
        setSending(false);
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
      }
    }
  };

  /**
   * Regenerate the last AI response
   */
  const handleRegenerateLast = async () => {
    if (sending) return;

    // Find the last user message
    const lastUserMsgIndex = messages.findLastIndex(m => m.role === 'user');
    if (lastUserMsgIndex === -1) return;

    // Find the first AI message after the last user message (if any)
    const firstAIMessageAfterUser = messages.slice(lastUserMsgIndex + 1).find(m => m.role === 'assistant');

    if (!firstAIMessageAfterUser) {
      // No AI response to regenerate
      return;
    }

    // Remove AI messages from UI (keep everything up to and including last user message)
    const messagesUpToUser = messages.slice(0, lastUserMsgIndex + 1);
    setMessages(messagesUpToUser);

    // Delete AI messages from backend
    try {
      const actualMessageId = extractActualMessageId(firstAIMessageAfterUser.id);
      await chatService.deleteMessagesFrom(actualMessageId);
    } catch (err) {
      console.error('Failed to delete AI messages:', err);
      setError('Failed to delete old response');
      return;
    }

    // Generate new AI response
    setSending(true);
    setError('');

    const currentCharacterId = characterId;

    // Random delay before showing typing indicator
    const typingDelay = Math.random() * 1500 + 500;
    const typingTimeout = setTimeout(() => {
      if (isMountedRef.current && currentCharacterId === characterId) {
        setShowTypingIndicatorInternal(true);
      }
    }, typingDelay);

    let messageDisplayDelay = 0;

    try {
      const response = await chatService.regenerateResponse(
        currentCharacterId,
        character.cardData.data
      );

      if (isMountedRef.current && currentCharacterId === characterId) {
        const newMessages = response.messages;
        const lastMessage = newMessages[newMessages.length - 1];

        if (lastMessage && lastMessage.role === 'assistant') {
          const messageParts = splitMessageIntoParts(lastMessage.content);

          if (messageParts.length > 1) {
            setDisplayingMessages(true);
            messageDisplayDelay = messageParts.length * 800;
            setShowTypingIndicatorInternal(false);

            const messagesWithoutLast = newMessages.slice(0, -1);
            setMessages(messagesWithoutLast);

            messageParts.forEach((part, index) => {
              const timeout = setTimeout(() => {
                if (isMountedRef.current && currentCharacterId === characterId) {
                  const partMessageId = `${lastMessage.id}-part-${index}`;
                  markMessageAsNew(partMessageId);
                  setMessages(prev => [...prev, {
                    ...lastMessage,
                    id: partMessageId,
                    content: part,
                    isLastPart: index === messageParts.length - 1
                  }]);

                  if (index === messageParts.length - 1) {
                    setDisplayingMessages(false);
                  }
                }
              }, index * 800);

              addDisplayTimeout(timeout);
            });
          } else {
            setShowTypingIndicatorInternal(false);
            markMessageAsNew(lastMessage.id);
            setMessages(newMessages);
          }
        } else {
          setMessages(newMessages);
        }

        setConversation(response.conversation);
        await chatService.markAsRead(currentCharacterId);
      }

      window.dispatchEvent(new Event('characterUpdated'));
    } catch (err) {
      console.error('Regenerate error:', err);
      if (currentCharacterId === characterId) {
        setError(err.response?.data?.error || 'Failed to regenerate response');
      }
    } finally {
      clearTimeout(typingTimeout);
      if (currentCharacterId === characterId) {
        setTimeout(() => {
          if (isMountedRef.current && currentCharacterId === characterId) {
            setSending(false);
            setShowTypingIndicatorInternal(false);
            setTimeout(() => inputRef.current?.focus(), 100);
          }
        }, messageDisplayDelay);
      }
    }
  };

  /**
   * Delete message and all messages after it
   */
  const handleDeleteFrom = async (messageIndex) => {
    if (!window.confirm('Delete this message and everything after it?')) return;

    const messageToDelete = messages[messageIndex];

    try {
      // Extract actual message ID (remove -part-N suffix if present)
      const actualMessageId = extractActualMessageId(messageToDelete.id);
      await chatService.deleteMessagesFrom(actualMessageId);

      // Update UI
      const messagesToKeep = messages.slice(0, messageIndex);
      setMessages(messagesToKeep);
      setError('');

      window.dispatchEvent(new Event('characterUpdated'));
    } catch (err) {
      console.error('Delete messages error:', err);
      setError(err.response?.data?.error || 'Failed to delete messages');
    }
  };

  /**
   * Start editing a message
   */
  const handleStartEdit = (message) => {
    setEditingMessageId(message.id);
    setEditingText(message.content);
  };

  /**
   * Cancel editing
   */
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  /**
   * Save edited message
   */
  const handleSaveEdit = async (messageId) => {
    if (!editingText.trim()) {
      handleCancelEdit();
      return;
    }

    try {
      // Extract actual message ID (remove -part-N suffix if present)
      const actualMessageId = extractActualMessageId(messageId);
      await chatService.editMessage(actualMessageId, editingText);

      // Update message in UI (update all parts if it's a multi-message)
      setMessages(prev => prev.map(msg => {
        const msgBaseId = extractActualMessageId(msg.id);
        return msgBaseId === actualMessageId ? { ...msg, content: editingText } : msg;
      }));

      handleCancelEdit();
      setError('');

      window.dispatchEvent(new Event('characterUpdated'));
    } catch (err) {
      console.error('Edit message error:', err);
      setError(err.response?.data?.error || 'Failed to edit message');
      handleCancelEdit();
    }
  };

  return {
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
  };
};
