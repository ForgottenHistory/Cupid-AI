import { useRef, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMood } from '../context/MoodContext';
import chatService from '../services/chatService';
import characterService from '../services/characterService';

// Custom hooks
import { useChat } from '../hooks/useChat';
import { useMessageDisplay } from '../hooks/useMessageDisplay';
import { useChatWebSocket } from '../hooks/useChatWebSocket';
import { useMessageActions } from '../hooks/useMessageActions';
import { useCharacterImage } from '../hooks/useCharacterImage';
import { useChatDebug } from '../hooks/useChatDebug';

// Components
import ChatHeader from '../components/chat/ChatHeader';
import MessageList from '../components/chat/MessageList';
import ChatInput from '../components/chat/ChatInput';
import UnmatchModal from '../components/UnmatchModal';
import ChatBackgroundEffects from '../components/chat/ChatBackgroundEffects';
import MoodModal from '../components/chat/MoodModal';
import ImageModal from '../components/ImageModal';
import CharacterImagePanel from '../components/chat/CharacterImagePanel';
import ChatBackgroundImage from '../components/chat/ChatBackgroundImage';
import ImageGallery from '../components/chat/ImageGallery';

const Chat = () => {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef(null);

  // Image upload state
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageDescription, setImageDescription] = useState('');

  // Image modal state (to hide input when viewing full-screen images)
  const [imageModalOpen, setImageModalOpen] = useState(false);

  // Swipe regeneration state
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Mood context (persistent per character)
  const { setMoodEffect, clearMoodEffect, closeMoodModal, getMoodForCharacter } = useMood();

  // Get mood state for current character
  const { effect: backgroundEffect, visible: backgroundVisible, showModal: showMoodModal, characterName: currentCharacterName } = getMoodForCharacter(characterId);

  // Core chat state
  const {
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
    totalMessages,
    hasMoreMessages,
    loadingMore,
    loadMoreMessages,
    allImageUrls,
    setAllImageUrls,
  } = useChat(characterId, user);

  // Character image display state
  const {
    showCharacterImage,
    setShowCharacterImage,
    autoScrollEnabled,
    setAutoScrollEnabled,
    currentImageIndex,
    backgroundHidden,
    setBackgroundHidden,
    showAsBackground,
    currentDisplayImage,
    receivedImages,
    showImageGallery,
    setShowImageGallery,
    galleryModalImage,
    setGalleryModalImage,
  } = useCharacterImage(characterId, character, allImageUrls);

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
    selectedImage,
    setSelectedImage,
    imageDescription,
    setImageDescription,
  });

  // WebSocket real-time messaging
  const { showTypingIndicator, setShowTypingIndicator, unmatchData, setUnmatchData, currentThought, isCompacting, characterMood, setCharacterMood, characterState, setCharacterState } = useChatWebSocket({
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
    setAllImageUrls,
  });

  // Debug functions (attach to window)
  useChatDebug({
    character,
    characterId,
    conversation,
    setUnmatchData,
    setMoodEffect,
    clearMoodEffect,
  });

  // Initialize character mood from conversation data
  useEffect(() => {
    if (conversation?.character_mood) {
      setCharacterMood(conversation.character_mood);
    } else {
      setCharacterMood(null);
    }
  }, [conversation?.character_mood, setCharacterMood]);

  // Initialize character state from conversation data
  useEffect(() => {
    if (conversation?.character_state) {
      setCharacterState(conversation.character_state);
    } else {
      setCharacterState(null);
    }
  }, [conversation?.character_state, setCharacterState]);

  // Debug: Log when thought changes
  useEffect(() => {
    if (currentThought) {
      console.log('[Chat] Displaying thought:', currentThought);
    } else {
      console.log('[Chat] Thought cleared');
    }
  }, [currentThought]);

  // Swipe handler - navigate to different variant
  const handleSwipe = async (messageId, swipeIndex) => {
    try {
      const response = await chatService.swipeMessage(messageId, swipeIndex);
      if (response.success && response.message) {
        setMessages(prev => prev.map(msg =>
          msg.id === messageId ? { ...msg, ...response.message } : msg
        ));
      }
    } catch (error) {
      console.error('Failed to swipe message:', error);
      setError('Failed to switch response variant');
    }
  };

  // Regenerate handler - generate new swipe variant
  const handleRegenerateSwipe = async (messageId) => {
    if (!character) return;

    setIsRegenerating(true);
    try {
      const response = await chatService.regenerateMessage(messageId, character);
      if (response.success && response.message) {
        setMessages(prev => prev.map(msg =>
          msg.id === messageId ? { ...msg, ...response.message } : msg
        ));
      }
    } catch (error) {
      console.error('Failed to regenerate message:', error);
      setError('Failed to generate new response');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Reset states when switching characters
  useEffect(() => {
    setSending(false);
    setDisplayingMessages(false);
    setShowTypingIndicatorInternal(false);
    clearDisplayTimeouts();
    setSelectedImage(null);
    setImageDescription('');
  }, [characterId]);

  // Check for 30-minute time gap when chat first loads and restore mood effects
  useEffect(() => {
    if (messages.length > 0 && !loading && character) {
      console.log(`[Chat] Checking mood restoration for ${character.name} (${characterId})`);

      // Find last non-system message (user or assistant)
      const lastNonSystemMsg = [...messages].reverse().find(m => m.role !== 'system');

      if (lastNonSystemMsg) {
        const lastMsgTime = new Date(lastNonSystemMsg.created_at).getTime();
        const nowTime = Date.now();
        const gapMinutes = (nowTime - lastMsgTime) / (1000 * 60);

        if (gapMinutes >= 30) {
          console.log(`[Chat] Conversation idle (${gapMinutes.toFixed(1)} min) - clearing instantly`);
          clearMoodEffect(characterId, true);
          return;
        }
      }

      // Find the most recent mood system message
      const moodPattern = /\[.+ switched background to (\w+)\]/;
      const lastMoodMsg = [...messages].reverse().find(m => {
        return m.role === 'system' && moodPattern.test(m.content);
      });

      if (lastMoodMsg) {
        const match = lastMoodMsg.content.match(moodPattern);
        const mood = match[1].toLowerCase();
        const moodTime = new Date(lastMoodMsg.created_at).getTime();
        const elapsed = Date.now() - moodTime;
        const thirtyMinutes = 30 * 60 * 1000;

        if (elapsed < thirtyMinutes) {
          const remaining = thirtyMinutes - elapsed;
          console.log(`[Chat] Restoring ${mood} for ${character.name} (${(remaining / 60000).toFixed(1)} min remaining, no modal)`);
          setMoodEffect(characterId, mood, character.name, remaining, false);
        } else {
          console.log(`[Chat] Mood expired (${(elapsed / 60000).toFixed(1)} min old) - clearing instantly`);
          clearMoodEffect(characterId, true);
        }
      } else {
        console.log(`[Chat] No mood message found for ${character.name} - clearing instantly`);
        clearMoodEffect(characterId, true);
      }
    }
  }, [characterId, loading]);

  // Handle unmatch
  const handleUnmatch = async () => {
    if (!window.confirm(`Are you sure you want to unmatch with ${character?.name}? This will remove them from your matches and delete all messages.`)) {
      return;
    }

    try {
      if (conversation?.id) {
        await chatService.deleteConversation(conversation.id);
      }
      await characterService.unlikeCharacter(characterId);
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

  // Get background gradient based on mood
  const getMoodBackgroundGradient = () => {
    switch (backgroundEffect) {
      case 'hearts':
        return 'bg-gradient-to-b from-pink-100 to-red-100 dark:from-pink-900 dark:to-red-900';
      case 'stars':
        return 'bg-gradient-to-b from-yellow-100 to-orange-100 dark:from-yellow-900 dark:to-orange-900';
      case 'laugh':
        return 'bg-gradient-to-b from-yellow-100 to-amber-100 dark:from-yellow-900 dark:to-amber-900';
      case 'sparkles':
        return 'bg-gradient-to-b from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900';
      case 'fire':
        return 'bg-gradient-to-b from-orange-100 to-red-100 dark:from-orange-900 dark:to-red-900';
      case 'roses':
        return 'bg-gradient-to-b from-pink-100 to-rose-100 dark:from-pink-900 dark:to-rose-900';
      default:
        return '';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-purple-50/30 to-pink-50/30 dark:from-gray-800/30 dark:to-gray-900/30 relative">
      {/* Horizontal Image Background */}
      <ChatBackgroundImage
        showAsBackground={showAsBackground}
        currentDisplayImage={currentDisplayImage}
        backgroundHidden={backgroundHidden}
        setBackgroundHidden={setBackgroundHidden}
        autoScrollEnabled={autoScrollEnabled}
        setAutoScrollEnabled={setAutoScrollEnabled}
        receivedImages={receivedImages}
        currentImageIndex={currentImageIndex}
        character={character}
      />

      {/* Mood Background Overlay */}
      {backgroundEffect !== 'none' && backgroundVisible && (
        <div
          className={`absolute inset-0 ${getMoodBackgroundGradient()} opacity-40 dark:opacity-20`}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Background Effects */}
      <ChatBackgroundEffects effect={backgroundEffect} visible={backgroundVisible} />

      {/* Chat Header */}
      {character && (
        <div className="relative z-10">
          <ChatHeader
            character={character}
            characterStatus={characterStatus}
            characterMood={characterMood}
            characterState={characterState}
            messages={messages}
            totalMessages={totalMessages}
            hasMoreMessages={hasMoreMessages}
            onBack={() => navigate('/')}
            onUnmatch={handleUnmatch}
            conversationId={conversation?.id}
            onMoodUpdate={setCharacterMood}
            onStateUpdate={setCharacterState}
            onCharacterUpdate={async () => {
              const updatedChar = await characterService.getCharacter(characterId);
              setCharacter(updatedChar);
            }}
          />
        </div>
      )}

      {/* Main Chat Area - Split view */}
      <div className="flex-1 flex overflow-hidden gap-4 p-4 relative z-10">
        {/* Left Side - Character Image Panel */}
        {character && (
          <CharacterImagePanel
            character={character}
            currentThought={currentThought}
            showCharacterImage={showCharacterImage}
            setShowCharacterImage={setShowCharacterImage}
            autoScrollEnabled={autoScrollEnabled}
            setAutoScrollEnabled={setAutoScrollEnabled}
            currentImageIndex={currentImageIndex}
            receivedImages={receivedImages}
            showAsBackground={showAsBackground}
            onOpenGallery={() => setShowImageGallery(true)}
          />
        )}

        {/* Right Side - Messages or Image Gallery */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Image Gallery View */}
          <ImageGallery
            isOpen={showImageGallery}
            onClose={() => setShowImageGallery(false)}
            character={character}
            allImageUrls={allImageUrls}
            onSelectImage={setGalleryModalImage}
          />

          {/* Message List */}
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
            imageModalOpen={imageModalOpen}
            setImageModalOpen={setImageModalOpen}
            hasMoreMessages={hasMoreMessages}
            loadingMore={loadingMore}
            onLoadMore={loadMoreMessages}
            totalMessages={totalMessages}
            onSwipe={handleSwipe}
            onRegenerate={handleRegenerateSwipe}
            isRegenerating={isRegenerating}
          />

          {/* Error Display */}
          {error && (
            <div className="px-6 py-2">
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm shadow-sm">
                {error}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compacting Overlay */}
      {isCompacting && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl border border-purple-200/50 dark:border-purple-800/50 max-w-md mx-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Compacting conversation...</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Extracting memories and summarizing messages
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      {!imageModalOpen && (
        <div className="relative z-10">
          <ChatInput
            input={input}
            setInput={setInput}
            sending={sending || isCompacting || isRegenerating}
            displayingMessages={displayingMessages}
            hasMessages={messages.length > 0}
            characterName={character?.name}
            characterId={characterId}
            character={character}
            inputRef={inputRef}
            onSend={handleSend}
            onRegenerate={handleRegenerateLast}
            selectedImage={selectedImage}
            setSelectedImage={setSelectedImage}
            imageDescription={imageDescription}
            setImageDescription={setImageDescription}
          />
        </div>
      )}

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

      {/* Mood Modal */}
      {showMoodModal && (
        <MoodModal
          effect={backgroundEffect}
          characterName={currentCharacterName}
          onClose={() => closeMoodModal(characterId)}
        />
      )}

      {/* Gallery Image Modal */}
      {galleryModalImage && (
        <ImageModal
          imageUrl={galleryModalImage.url}
          imagePrompt={galleryModalImage.prompt}
          onClose={() => setGalleryModalImage(null)}
        />
      )}
    </div>
  );
};

export default Chat;
