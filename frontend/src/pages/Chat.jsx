import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import chatService from '../services/chatService';
import characterService from '../services/characterService';

const Chat = () => {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [character, setCharacter] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const [displayingMessages, setDisplayingMessages] = useState(false);
  const [error, setError] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [newMessageIds, setNewMessageIds] = useState(new Set());
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const isMountedRef = useRef(true);
  const displayTimeoutsRef = useRef([]);

  useEffect(() => {
    isMountedRef.current = true;
    loadCharacterAndChat();
    // Reset sending state when switching characters
    setSending(false);
    setShowTypingIndicator(false);
    setDisplayingMessages(false);

    // Cleanup function to track unmounting
    return () => {
      isMountedRef.current = false;
      // Clear any pending display timeouts
      displayTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      displayTimeoutsRef.current = [];
    };
  }, [characterId, user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, showTypingIndicator]);

  // Remove message IDs from newMessageIds after animation completes
  useEffect(() => {
    if (newMessageIds.size > 0) {
      const timeout = setTimeout(() => {
        setNewMessageIds(new Set());
      }, 350); // Slightly longer than animation duration (300ms)

      return () => clearTimeout(timeout);
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const markMessageAsNew = (messageId) => {
    setNewMessageIds(prev => new Set([...prev, messageId]));
  };

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

  const handleUnmatch = async () => {
    if (!window.confirm(`Are you sure you want to unmatch with ${character?.name}? This will remove them from your matches and delete all messages.`)) {
      return;
    }

    try {
      // Delete conversation and messages
      if (conversation?.id) {
        await chatService.deleteConversation(conversation.id);
      }
      // Unlike character
      await characterService.unlikeCharacter(characterId);
      // Notify other components to refresh
      window.dispatchEvent(new Event('characterUpdated'));
      navigate('/');
    } catch (err) {
      console.error('Unmatch error:', err);
      setError('Failed to unmatch. Please try again.');
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();

    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    const currentCharacterId = characterId; // Capture current character ID
    setInput('');
    setSending(true);
    setError('');

    // Optimistically add user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };

    markMessageAsNew(tempUserMsg.id);
    setMessages(prev => [...prev, tempUserMsg]);

    // Random delay (500ms - 2000ms) before showing typing indicator
    const typingDelay = Math.random() * 1500 + 500;
    const typingTimeout = setTimeout(() => {
      if (isMountedRef.current && currentCharacterId === characterId) {
        setShowTypingIndicator(true);
      }
    }, typingDelay);

    let messageDisplayDelay = 0;

    try {
      const response = await chatService.sendMessage(
        currentCharacterId,
        userMessage,
        character.cardData.data
      );

      // Only update if component is still mounted AND viewing the same character
      if (isMountedRef.current && currentCharacterId === characterId) {
        const oldMessages = messages;
        const newMessages = response.messages;

        // Find the new AI message (last message in the response)
        const lastMessage = newMessages[newMessages.length - 1];

        if (lastMessage && lastMessage.role === 'assistant') {
          // Split AI message by newlines for progressive display
          const messageParts = lastMessage.content.split('\n').filter(part => part.trim());

          if (messageParts.length > 1) {
            // Multiple parts - display progressively
            setDisplayingMessages(true);
            messageDisplayDelay = messageParts.length * 800;
            setShowTypingIndicator(false); // Hide typing indicator immediately

            // Show messages without the AI response first
            const messagesWithoutLast = newMessages.slice(0, -1);
            setMessages(messagesWithoutLast);

            // Display each part with a delay
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

                  // On last part, finish up
                  if (index === messageParts.length - 1) {
                    setDisplayingMessages(false);
                  }
                }
              }, index * 800); // 800ms delay between each message

              displayTimeoutsRef.current.push(timeout);
            });
          } else {
            // Single message - display immediately
            setShowTypingIndicator(false);
            markMessageAsNew(lastMessage.id);
            setMessages(newMessages);
          }
        } else {
          // No AI message or not assistant - display normally
          setMessages(newMessages);
        }

        setConversation(response.conversation);

        // Mark as read since user is viewing the chat
        await chatService.markAsRead(currentCharacterId);
      }

      // Always notify sidebar to refresh (even if user navigated away)
      window.dispatchEvent(new Event('characterUpdated'));
    } catch (err) {
      console.error('Send message error:', err);
      // Only show error if still viewing the same character
      if (currentCharacterId === characterId) {
        setError(err.response?.data?.error || 'Failed to send message');
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
      }
    } finally {
      clearTimeout(typingTimeout);
      // Only clear sending state if still viewing the same character
      if (currentCharacterId === characterId) {
        // Wait for all message parts to display before clearing sending state
        setTimeout(() => {
          if (isMountedRef.current && currentCharacterId === characterId) {
            setSending(false);
            setShowTypingIndicator(false);
            // Auto-focus input after generation completes
            setTimeout(() => {
              inputRef.current?.focus();
            }, 100);
          }
        }, messageDisplayDelay);
      }
    }
  };

  const handleRegenerateLast = async () => {
    if (sending || displayingMessages) return;

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
      const actualMessageId = firstAIMessageAfterUser.id.toString().split('-part-')[0];
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
        setShowTypingIndicator(true);
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
          const messageParts = lastMessage.content.split('\n').filter(part => part.trim());

          if (messageParts.length > 1) {
            setDisplayingMessages(true);
            messageDisplayDelay = messageParts.length * 800;
            setShowTypingIndicator(false);

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

              displayTimeoutsRef.current.push(timeout);
            });
          } else {
            setShowTypingIndicator(false);
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
            setShowTypingIndicator(false);
            setTimeout(() => inputRef.current?.focus(), 100);
          }
        }, messageDisplayDelay);
      }
    }
  };

  const handleDeleteFrom = async (messageIndex) => {
    if (!window.confirm('Delete this message and everything after it?')) return;

    const messageToDelete = messages[messageIndex];

    try {
      // Extract actual message ID (remove -part-N suffix if present)
      const actualMessageId = messageToDelete.id.toString().split('-part-')[0];
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

  const handleStartEdit = (message) => {
    setEditingMessageId(message.id);
    setEditingText(message.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (messageId) => {
    if (!editingText.trim()) {
      handleCancelEdit();
      return;
    }

    try {
      // Extract actual message ID (remove -part-N suffix if present)
      const actualMessageId = messageId.toString().split('-part-')[0];
      await chatService.editMessage(actualMessageId, editingText);

      // Update message in UI (update all parts if it's a multi-message)
      setMessages(prev => prev.map(msg => {
        const msgBaseId = msg.id.toString().split('-part-')[0];
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (error && !character) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-purple-50/30 to-pink-50/30">
      {/* Chat Header with Banner */}
      {character && (
        <div className="relative flex-shrink-0">
          {/* Banner Image */}
          <div className="relative h-48 overflow-hidden">
            <img
              src={character.imageUrl}
              alt={character.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60"></div>

            {/* Back Button */}
            <button
              onClick={() => navigate('/')}
              className="absolute top-4 left-4 p-2 bg-black/30 backdrop-blur-sm text-white rounded-full hover:bg-black/50 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Menu Button */}
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 bg-black/30 backdrop-blur-sm text-white rounded-full hover:bg-black/50 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-12 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px] z-20">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        handleUnmatch();
                      }}
                      className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Unmatch
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Character Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="flex items-end gap-4">
                <img
                  src={character.imageUrl}
                  alt={character.name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-xl"
                />
                <div className="flex-1 pb-1">
                  <h2 className="text-2xl font-bold drop-shadow-lg">{character.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2.5 h-2.5 bg-green-400 rounded-full shadow-lg"></div>
                    <span className="text-sm font-medium drop-shadow">Online</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
        {messages.map((message, index) => (
          <div
            key={message.id || index}
            className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${newMessageIds.has(message.id) ? 'animate-slideUp' : ''} group`}
          >
            {/* Action Buttons (left side for assistant, right side for user) */}
            {message.role === 'assistant' && (
              <div className="flex items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleStartEdit(message)}
                  className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition"
                  title="Edit message"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteFrom(index)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                  title="Delete from here"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}

            {/* Message Bubble */}
            {editingMessageId === message.id ? (
              <div className="max-w-[70%] space-y-2">
                <textarea
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-purple-400 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveEdit(message.id)}
                    className="px-3 py-1.5 text-sm bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`max-w-[70%] rounded-2xl px-5 py-3 shadow-sm ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-pink-200'
                    : 'bg-white text-gray-900 shadow-gray-200 border border-gray-100'
                }`}
              >
                <p className="break-words leading-relaxed">{message.content}</p>
                {/* Show timestamp for user messages or last part of assistant multi-messages */}
                {(message.role === 'user' || !message.id?.toString().includes('-part-') || message.isLastPart) && (
                  <p
                    className={`text-xs mt-2 ${
                      message.role === 'user' ? 'text-white/70' : 'text-gray-400'
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons (right side for user) */}
            {message.role === 'user' && (
              <div className="flex items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleStartEdit(message)}
                  className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition"
                  title="Edit message"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteFrom(index)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                  title="Delete from here"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}

        {showTypingIndicator && (
          <div className="flex justify-start px-2 py-1">
            <p className="text-sm text-gray-400 italic">
              {character?.name} is typing...
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-6 py-2">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm shadow-sm">
            {error}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200/50 bg-white/80 backdrop-blur-sm p-4 flex-shrink-0">
        <form onSubmit={handleSend} className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${character?.name || 'character'}...`}
            className="flex-1 px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-full focus:ring-2 focus:ring-purple-400 focus:border-transparent focus:bg-white text-gray-900 transition-all shadow-sm"
          />
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleRegenerateLast}
              disabled={sending || displayingMessages}
              title="Regenerate last response"
              className="px-4 py-3.5 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transform hover:scale-105 active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="px-7 py-3.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full hover:from-pink-600 hover:to-purple-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg disabled:shadow-sm transform hover:scale-105 active:scale-95"
          >
            {sending ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Sending
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>Send</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
