import { useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import chatService from '../services/chatService';
import characterService from '../services/characterService';

// Custom hooks
import { useChat } from '../hooks/useChat';
import { useMessageDisplay } from '../hooks/useMessageDisplay';
import { useChatWebSocket } from '../hooks/useChatWebSocket';
import { useMessageActions } from '../hooks/useMessageActions';

// Components
import ChatHeader from '../components/chat/ChatHeader';
import MessageList from '../components/chat/MessageList';
import ChatInput from '../components/chat/ChatInput';
import UnmatchModal from '../components/UnmatchModal';

const Chat = () => {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef(null);

  // Core chat state
  const {
    character,
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
  } = useChat(characterId, user);

  // Message display and animation
  const {
    newMessageIds,
    displayingMessages,
    setDisplayingMessages,
    markMessageAsNew,
    addDisplayTimeout,
    clearDisplayTimeouts,
  } = useMessageDisplay(messages, messagesEndRef, false);

  // Message actions (send, regenerate, edit, delete)
  const {
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
  } = useMessageActions({
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
  });

  // WebSocket real-time messaging
  const { showTypingIndicator, setShowTypingIndicator, unmatchData, setUnmatchData } = useChatWebSocket({
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
  });

  // Reset states when switching characters
  useEffect(() => {
    setSending(false);
    setDisplayingMessages(false);
    setShowTypingIndicator(false);
    setShowTypingIndicatorInternal(false);
    clearDisplayTimeouts();
  }, [characterId]);

  // Debug function for testing unmatch modal
  useEffect(() => {
    if (character) {
      window.debugUnmatch = () => {
        console.log('🐛 Debug: Triggering unmatch modal');
        setUnmatchData({
          characterId: character.id,
          characterName: character.name,
          reason: 'Debug test unmatch'
        });
      };
    }
    return () => {
      delete window.debugUnmatch;
    };
  }, [character]);

  // Handle unmatch
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

  // Loading state
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

  // Error state (character not found)
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

  // Combine typing indicators (WebSocket + internal for regenerate)
  const showAnyTypingIndicator = showTypingIndicator || showTypingIndicatorInternal;

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-purple-50/30 to-pink-50/30 dark:from-gray-800/30 dark:to-gray-900/30">
      {/* Chat Header */}
      {character && (
        <ChatHeader
          character={character}
          characterStatus={characterStatus}
          onBack={() => navigate('/')}
          onUnmatch={handleUnmatch}
        />
      )}

      {/* Messages */}
      <MessageList
        messages={messages}
        character={character}
        showTypingIndicator={showAnyTypingIndicator}
        newMessageIds={newMessageIds}
        editingMessageId={editingMessageId}
        editingText={editingText}
        setEditingText={setEditingText}
        onStartEdit={handleStartEdit}
        onCancelEdit={handleCancelEdit}
        onSaveEdit={handleSaveEdit}
        onDeleteFrom={handleDeleteFrom}
        messagesEndRef={messagesEndRef}
      />

      {/* Error Display */}
      {error && (
        <div className="px-6 py-2">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm shadow-sm">
            {error}
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput
        input={input}
        setInput={setInput}
        sending={sending}
        displayingMessages={displayingMessages}
        hasMessages={messages.length > 0}
        characterName={character?.name}
        characterId={characterId}
        character={character}
        inputRef={inputRef}
        onSend={handleSend}
        onRegenerate={handleRegenerateLast}
      />

      {/* Unmatch Modal */}
      {unmatchData && (
        <UnmatchModal
          character={{
            name: unmatchData.characterName || character?.name,
            imageUrl: character?.imageUrl
          }}
          onClose={() => setUnmatchData(null)}
        />
      )}
    </div>
  );
};

export default Chat;
