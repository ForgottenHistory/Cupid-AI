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

// Components
import ChatHeader from '../components/chat/ChatHeader';
import MessageList from '../components/chat/MessageList';
import ChatInput from '../components/chat/ChatInput';
import UnmatchModal from '../components/UnmatchModal';
import ChatBackgroundEffects from '../components/chat/ChatBackgroundEffects';
import MoodModal from '../components/chat/MoodModal';

const Chat = () => {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef(null);

  // Image upload state
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageDescription, setImageDescription] = useState('');

  // Character image visibility state (default visible)
  const [showCharacterImage, setShowCharacterImage] = useState(true);

  // Image modal state (to hide input when viewing full-screen images)
  const [imageModalOpen, setImageModalOpen] = useState(false);

  // Swipe regeneration state
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Auto-scroll mode for character images
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const autoScrollIntervalRef = useRef(null);
  const hasAutoEnabledRef = useRef(false);

  // Mood context (persistent per character)
  const { setMoodEffect, clearMoodEffect, closeMoodModal, getMoodForCharacter } = useMood();

  // Get mood state for current character
  const { effect: backgroundEffect, visible: backgroundVisible, showModal: showMoodModal, characterName: currentCharacterName } = getMoodForCharacter(characterId);

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
    totalMessages,
    hasMoreMessages,
    loadingMore,
    loadMoreMessages,
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
    selectedImage,
    setSelectedImage,
    imageDescription,
    setImageDescription,
  });

  // WebSocket real-time messaging
  const { showTypingIndicator, setShowTypingIndicator, unmatchData, setUnmatchData, currentThought, isCompacting } = useChatWebSocket({
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

  // Debug: Log when thought changes
  useEffect(() => {
    if (currentThought) {
      console.log('💭 [UI] Displaying thought:', currentThought);
    } else {
      console.log('💭 [UI] Thought cleared');
    }
  }, [currentThought]);

  // Swipe handler - navigate to different variant
  const handleSwipe = async (messageId, swipeIndex) => {
    try {
      const response = await chatService.swipeMessage(messageId, swipeIndex);
      if (response.success && response.message) {
        // Update message in local state
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
        // Update message in local state with new content and swipes
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

  // Extract received images from character messages (last 10 only)
  const receivedImages = messages
    .filter(m => m.role === 'assistant' && m.message_type === 'image' && m.image_url)
    .slice(-10)
    .map(m => `http://localhost:3000${m.image_url}`);

  // Reset states when switching characters
  useEffect(() => {
    setSending(false);
    setDisplayingMessages(false);
    // Don't reset showTypingIndicator - let WebSocket hook manage it based on actual state
    setShowTypingIndicatorInternal(false);
    clearDisplayTimeouts();
    // Note: input text is managed by useMessageActions hook (per-chat caching)
    // Reset image upload state
    setSelectedImage(null);
    setImageDescription('');
    // Reset auto-scroll state and flag
    setAutoScrollEnabled(false);
    // Randomize initial image index
    setCurrentImageIndex(receivedImages.length > 0 ? Math.floor(Math.random() * receivedImages.length) : 0);
    hasAutoEnabledRef.current = false;
  }, [characterId, receivedImages.length]);

  // Auto-scroll timer for cycling through received images
  useEffect(() => {
    // Clear any existing interval
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }

    // Only start interval if auto-scroll is enabled and there are images to scroll through
    if (autoScrollEnabled && receivedImages.length > 0) {
      console.log(`🔄 Auto-scroll enabled with ${receivedImages.length} images`);

      // Cycle every 60 seconds with random selection
      autoScrollIntervalRef.current = setInterval(() => {
        setCurrentImageIndex(() => {
          // Pick random index
          return Math.floor(Math.random() * receivedImages.length);
        });
      }, 60000);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }
    };
  }, [autoScrollEnabled, receivedImages.length]);

  // Randomize image index when toggling auto-scroll or when images change
  useEffect(() => {
    if (!autoScrollEnabled && receivedImages.length > 0) {
      setCurrentImageIndex(Math.floor(Math.random() * receivedImages.length));
    }
  }, [autoScrollEnabled, receivedImages.length]);

  // Auto-enable auto-scroll when images are available (only once per character)
  useEffect(() => {
    if (receivedImages.length > 0 && !autoScrollEnabled && !hasAutoEnabledRef.current) {
      setAutoScrollEnabled(true);
      hasAutoEnabledRef.current = true;
      console.log(`🔄 Auto-enabled image scroll (${receivedImages.length} images available)`);
    }
  }, [receivedImages.length, autoScrollEnabled]);

  // Check for 30-minute time gap when chat first loads and restore mood effects
  useEffect(() => {
    if (messages.length > 0 && !loading && character) {
      console.log(`🔍 Checking mood restoration for ${character.name} (${characterId})`);

      // Find last non-system message (user or assistant)
      const lastNonSystemMsg = [...messages].reverse().find(m => m.role !== 'system');

      if (lastNonSystemMsg) {
        const lastMsgTime = new Date(lastNonSystemMsg.created_at).getTime();
        const nowTime = Date.now();
        const gapMinutes = (nowTime - lastMsgTime) / (1000 * 60);

        if (gapMinutes >= 30) {
          console.log(`⏰ Conversation idle (${gapMinutes.toFixed(1)} min) - clearing instantly`);
          clearMoodEffect(characterId, true); // instant clear
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

        // Only restore if mood is less than 30 minutes old
        if (elapsed < thirtyMinutes) {
          const remaining = thirtyMinutes - elapsed;
          console.log(`🔄 Restoring ${mood} for ${character.name} (${(remaining / 60000).toFixed(1)} min remaining, no modal)`);
          setMoodEffect(characterId, mood, character.name, remaining, false); // false = don't show modal
        } else {
          console.log(`⏰ Mood expired (${(elapsed / 60000).toFixed(1)} min old) - clearing instantly`);
          clearMoodEffect(characterId, true); // instant clear
        }
      } else {
        console.log(`📭 No mood message found for ${character.name} - clearing instantly`);
        clearMoodEffect(characterId, true); // instant clear
      }
    }
    // Only run when characterId changes or loading finishes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, loading]);

  // Debug function for testing unmatch modal
  useEffect(() => {
    if (character) {
      // Expose conversation ID for debug functions
      window.__currentConversationId = conversation?.id || null;

      window.debugUnmatch = () => {
        console.log('🐛 Debug: Triggering unmatch modal');
        setUnmatchData({
          characterId: character.id,
          characterName: character.name,
          reason: 'Debug test unmatch'
        });
      };

      // Debug function for generating character image
      window.debugGenerateImage = async (contextTags = 'smiling, casual clothes, outdoors, daytime') => {
        console.log('🐛 Debug: Generating image for', character.name);
        console.log('🎨 Context tags:', contextTags);

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`http://localhost:3000/api/debug/generate-image/${character.id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ contextTags })
          });

          if (!response.ok) {
            const error = await response.json();
            console.error('❌ Image generation failed:', error);
            alert(`Failed to generate image: ${error.error}`);
            return;
          }

          const result = await response.json();
          console.log('✅ Image generated!');
          console.log('📝 Full prompt:', result.prompt);

          // Download image
          try {
            const link = document.createElement('a');
            link.href = result.image;
            link.download = `${character.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log('💾 Image downloaded!');
            alert(`Image generated and downloaded!\n\nPrompt: ${result.prompt}`);
          } catch (downloadError) {
            console.error('Download failed, showing image in console instead:', downloadError);
            console.log('🖼️ Image data:', result.image);

            // Try to open in new window as fallback
            try {
              const newWindow = window.open('', '_blank');
              if (newWindow) {
                newWindow.document.write(`
                  <html>
                    <head><title>${character.name} - Generated Image</title></head>
                    <body style="margin: 0; background: #000; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh;">
                      <img src="${result.image}" style="max-width: 90vw; max-height: 80vh; object-fit: contain;" />
                      <div style="color: white; text-align: center; padding: 20px; font-family: monospace; font-size: 12px; max-width: 90vw; word-wrap: break-word;">
                        <p><strong>Prompt:</strong> ${result.prompt}</p>
                        <p style="margin-top: 10px;"><em>Right-click image to save</em></p>
                      </div>
                    </body>
                  </html>
                `);
                newWindow.document.close();
              } else {
                alert('Image generated! Check console for image data (copy the data URI to browser to view)');
              }
            } catch (windowError) {
              alert('Image generated! Check console - copy the image data URI to your browser to view it.');
            }
          }
        } catch (error) {
          console.error('❌ Debug image generation error:', error);
          alert(`Error: ${error.message}`);
        }
      };

      // Debug function for testing chat background effects (frontend only)
      window.debugChatBackground = (effect = 'hearts') => {
        const validEffects = ['none', 'hearts', 'stars', 'laugh', 'sparkles', 'fire', 'roses'];
        if (!validEffects.includes(effect)) {
          console.log(`❌ Invalid effect. Valid options: ${validEffects.join(', ')}`);
          return;
        }
        console.log(`🎨 Setting chat background effect: ${effect} for character ${characterId}`);

        if (effect !== 'none') {
          // Pass auto-clear timeout to context (30 minutes)
          setMoodEffect(characterId, effect, character?.name || 'Character', 30 * 60 * 1000);
        } else {
          clearMoodEffect(characterId);
        }
      };

      // Debug function for full mood system (backend + frontend)
      window.debugMood = async (mood = 'hearts') => {
        const validMoods = ['hearts', 'stars', 'laugh', 'sparkles', 'fire', 'roses'];
        if (!validMoods.includes(mood)) {
          console.log(`❌ Invalid mood. Valid options: ${validMoods.join(', ')}`);
          return;
        }

        console.log(`🎨 Triggering full mood system: ${mood} for character ${characterId}`);

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`http://localhost:3000/api/chat/conversations/${characterId}/debug-mood`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ mood, characterName: character?.name })
          });

          if (!response.ok) {
            const error = await response.json();
            console.error('❌ Mood trigger failed:', error);
            return;
          }

          const result = await response.json();
          console.log('✅ Mood triggered successfully!');
          console.log('📝 System message:', result.systemMessage);
        } catch (error) {
          console.error('❌ Debug mood error:', error);
        }
      };
    }
    return () => {
      delete window.debugUnmatch;
      delete window.debugGenerateImage;
      delete window.debugChatBackground;
      delete window.debugMood;
      delete window.__currentConversationId;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character, conversation]);

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
      {/* Mood Background Overlay - Only render when visible to avoid flash */}
      {backgroundEffect !== 'none' && backgroundVisible && (
        <div
          className={`absolute inset-0 ${getMoodBackgroundGradient()} opacity-40 dark:opacity-20`}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Background Effects */}
      <ChatBackgroundEffects effect={backgroundEffect} visible={backgroundVisible} />

      {/* Chat Header - Always visible */}
      {character && (
        <div className="relative z-10">
          <ChatHeader
            character={character}
            characterStatus={characterStatus}
            messages={messages}
            totalMessages={totalMessages}
            hasMoreMessages={hasMoreMessages}
            onBack={() => navigate('/')}
            onUnmatch={handleUnmatch}
            conversationId={conversation?.id}
          />
        </div>
      )}

      {/* Main Chat Area - Split view */}
      <div className="flex-1 flex overflow-hidden gap-4 p-4 relative z-10">
        {/* Left Side - Character Image (with smooth transitions) */}
        {character && (
          <div
            className={`relative overflow-hidden rounded-2xl shadow-2xl flex-shrink-0 border border-purple-200/30 dark:border-gray-600/30 group transition-all duration-300 ease-in-out ${
              showCharacterImage ? 'w-[320px] opacity-100' : 'w-0 opacity-0 border-0'
            }`}
          >
            {/* Image with gradient overlays for depth */}
            <div className="absolute inset-0">
              <img
                src={autoScrollEnabled && receivedImages.length > 0 ? receivedImages[currentImageIndex] : character.imageUrl}
                alt={character.name}
                className="w-full h-full object-cover object-center transition-opacity duration-500"
                style={{
                  imageRendering: 'auto',
                  transform: 'translateZ(0)',
                  backfaceVisibility: 'hidden'
                }}
              />
              {/* Top gradient fade */}
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/50 via-black/20 to-transparent"></div>
              {/* Gradient overlays for sleek blending */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-purple-50/20 dark:to-gray-800/30"></div>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10 dark:to-black/30"></div>
              {/* Subtle vignette effect */}
              <div className="absolute inset-0 shadow-inner" style={{
                boxShadow: 'inset 0 0 100px rgba(0,0,0,0.1)'
              }}></div>
            </div>

            {/* Thought Display - Top Left */}
            {currentThought && (
              <div className="absolute top-4 left-4 max-w-[240px] animate-fade-in">
                <div className="bg-black/60 backdrop-blur-md rounded-lg px-3 py-2 shadow-xl border border-white/10">
                  <div className="flex items-start gap-2">
                    <span className="text-base opacity-60">💭</span>
                    <p className="text-xs text-white/90 leading-relaxed italic">
                      {currentThought}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Control Buttons - Top Right */}
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
              {/* Auto-scroll Toggle Button */}
              {receivedImages.length > 0 && (
                <button
                  onClick={() => setAutoScrollEnabled(!autoScrollEnabled)}
                  className={`p-2 backdrop-blur-sm rounded-lg transition-all shadow-lg ${
                    autoScrollEnabled
                      ? 'bg-purple-500/80 hover:bg-purple-600/80'
                      : 'bg-black/40 hover:bg-black/60'
                  }`}
                  title={autoScrollEnabled ? `Auto-scroll ON (${receivedImages.length} images)` : `Enable auto-scroll (${receivedImages.length} images)`}
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {autoScrollEnabled ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )}
                  </svg>
                </button>
              )}

              {/* Hide Image Button */}
              <button
                onClick={() => setShowCharacterImage(false)}
                className="p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-lg transition-all shadow-lg"
                title="Hide character image"
              >
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* Character name overlay at bottom - multiple layers for smooth blur fade */}
            <div className="absolute bottom-0 left-0 right-0 h-32">
              {/* Blur layer with very gradual fade */}
              <div className="absolute inset-0 backdrop-blur-sm" style={{
                maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0) 100%)',
                WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0) 100%)'
              }}></div>
              {/* Dark gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-40% via-black/20 to-transparent"></div>
              {/* Text */}
              <div className="absolute bottom-5 left-5 right-5">
                <h2 className="text-xl font-bold text-white drop-shadow-lg">{character.name}</h2>
                {/* Auto-scroll indicator */}
                {autoScrollEnabled && receivedImages.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/80 backdrop-blur-sm rounded-full text-xs font-medium text-white shadow-lg">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                        <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{currentImageIndex + 1} / {receivedImages.length}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Show Image Button (when hidden) */}
        {character && !showCharacterImage && (
          <button
            onClick={() => setShowCharacterImage(true)}
            className="w-12 flex-shrink-0 bg-white dark:bg-gray-800 border border-purple-200/30 dark:border-gray-600/30 rounded-xl shadow-lg hover:bg-purple-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center animate-fade-in"
            title="Show character image"
          >
            <svg
              className="w-6 h-6 text-purple-600 dark:text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Right Side - Messages */}
        <div className="flex-1 flex flex-col min-w-0">
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

      {/* Input - Hidden when image modal is open */}
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
    </div>
  );
};

export default Chat;
