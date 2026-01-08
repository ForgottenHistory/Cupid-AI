import { useState, useRef, useEffect } from 'react';
import chatService from '../services/chatService';
import { extractActualMessageId } from '../utils/messageUtils';
import { useMood } from '../context/MoodContext';

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
  selectedImage,
  setSelectedImage,
  imageDescription,
  setImageDescription,
}) => {
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [showTypingIndicatorInternal, setShowTypingIndicatorInternal] = useState(false);

  // Get mood context
  const { clearMoodEffect } = useMood();

  // Cache input text per character
  const inputCacheRef = useRef({});
  const previousCharacterIdRef = useRef(characterId);

  // Save/restore input text when switching characters
  useEffect(() => {
    const prevCharId = previousCharacterIdRef.current;

    // Save current input to cache before switching
    if (prevCharId && prevCharId !== characterId) {
      inputCacheRef.current[prevCharId] = input;
      console.log(`💾 Saved input for ${prevCharId}:`, input);
    }

    // Restore input from cache for new character
    const cachedInput = inputCacheRef.current[characterId] || '';
    setInput(cachedInput);
    console.log(`📥 Restored input for ${characterId}:`, cachedInput);

    // Update previous character ID
    previousCharacterIdRef.current = characterId;
  }, [characterId]);

  /**
   * Send a new message
   */
  const handleSend = async (e) => {
    e.preventDefault();

    if (sending) return;

    const userMessage = input.trim();
    const hasImage = selectedImage && imageDescription.trim();
    const currentCharacterId = characterId; // Capture current character ID

    // Check for 30-minute time gap and clear mood effects if needed
    if (messages.length > 0) {
      // Find last non-system message (user or assistant)
      const lastNonSystemMsg = [...messages].reverse().find(m => m.role !== 'system');

      if (lastNonSystemMsg) {
        const lastMsgTime = new Date(lastNonSystemMsg.created_at).getTime();
        const nowTime = Date.now();
        const gapMinutes = (nowTime - lastMsgTime) / (1000 * 60);

        if (gapMinutes >= 30) {
          console.log(`⏰ Time gap of ${gapMinutes.toFixed(1)} minutes detected - clearing mood effects`);
          clearMoodEffect(characterId);
        }
      }
    }

    setInput('');
    setSending(true);
    setError('');

    // If no message and no image, skip adding user message and just prompt AI to continue
    if (!userMessage && !hasImage) {
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

    // Handle image upload if present
    let uploadedImageUrl = null;
    if (hasImage) {
      try {
        // Upload image first
        const formData = new FormData();
        formData.append('image', selectedImage);

        const token = localStorage.getItem('token');
        const uploadResponse = await fetch('http://localhost:3000/api/chat/upload-user-image', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image');
        }

        const uploadData = await uploadResponse.json();
        uploadedImageUrl = uploadData.imageUrl;
        console.log('✅ Image uploaded:', uploadedImageUrl);
      } catch (err) {
        console.error('Image upload error:', err);
        setError('Failed to upload image');
        setSending(false);
        return;
      }
    }

    // Optimistically add user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: hasImage ? imageDescription.trim() : userMessage,
      created_at: new Date().toISOString(),
      message_type: hasImage ? 'image' : 'text',
      image_url: uploadedImageUrl,
    };

    markMessageAsNew(tempUserMsg.id);
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      // Send message to backend (returns immediately)
      const response = await chatService.sendMessage(
        currentCharacterId,
        hasImage ? '' : userMessage, // Send empty message if sending image
        character.cardData.data,
        uploadedImageUrl, // imageUrl
        hasImage ? imageDescription.trim() : null // imageDescription
      );

      // Clear image state after successful send
      if (hasImage) {
        setSelectedImage(null);
        setImageDescription('');
      }

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
        setShowTypingIndicatorInternal(false);

        // Mark new messages for animation and append them
        response.newMessages.forEach(msg => {
          markMessageAsNew(msg.id);
        });

        setMessages(prev => [...prev, ...response.newMessages]);
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
   * @param {number|string} messageIndexOrId - Either message index or message ID
   */
  const handleDeleteFrom = async (messageIndexOrId) => {
    if (!window.confirm('Delete this message and everything after it?')) return;

    // Handle both index (number) and ID (string) inputs
    let messageToDelete;
    let messageIndex;

    if (typeof messageIndexOrId === 'number') {
      // Called with index (from MessageBubble)
      messageIndex = messageIndexOrId;
      messageToDelete = messages[messageIndex];
      console.log('🗑️ Found message by index:', messageToDelete);
    } else {
      // Called with ID (from SystemMessage) - compare with type coercion since ID might be string or number
      messageToDelete = messages.find(m => m.id == messageIndexOrId); // Loose equality to handle string/number
      messageIndex = messages.findIndex(m => m.id == messageIndexOrId);
      console.log('🗑️ Found message by ID:', messageToDelete, 'at index:', messageIndex);
    }

    if (!messageToDelete) {
      console.error('🗑️ Message not found!');
      setError('Message not found');
      return;
    }

    // Check if this is a mood system message and clear effects if so
    if (messageToDelete.role === 'system') {
      // Pattern: [CharacterName switched background to MOOD]
      const moodPattern = /\[.+ switched background to (\w+)\]/;
      const match = messageToDelete.content.match(moodPattern);

      if (match) {
        const mood = match[1].toLowerCase();
        console.log(`🧹 Detected mood system message deletion: ${mood} - clearing effects for character ${characterId}`);
        clearMoodEffect(characterId);
      }
    }

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
