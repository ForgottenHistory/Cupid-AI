import { useRef, useEffect, useState } from 'react';
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

  // Image upload state
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageDescription, setImageDescription] = useState('');

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
    selectedImage,
    setSelectedImage,
    imageDescription,
    setImageDescription,
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
    // Don't reset showTypingIndicator - let WebSocket hook manage it based on actual state
    setShowTypingIndicatorInternal(false);
    clearDisplayTimeouts();
    // Note: input text is managed by useMessageActions hook (per-chat caching)
    // Reset image upload state
    setSelectedImage(null);
    setImageDescription('');
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

      console.log('🐛 Debug functions available:');
      console.log('  - debugUnmatch() - Test unmatch modal');
      console.log('  - debugGenerateImage(contextTags) - Generate character image');
      console.log('    Example: debugGenerateImage("smiling, waving, park, sunny day")');
    }
    return () => {
      delete window.debugUnmatch;
      delete window.debugGenerateImage;
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
          messages={messages}
          onBack={() => navigate('/')}
          onUnmatch={handleUnmatch}
        />
      )}

      {/* Main Chat Area - Split view */}
      <div className="flex-1 flex overflow-hidden gap-4 p-4">
        {/* Left Side - Character Image */}
        {character && (
          <div className="w-[320px] relative overflow-hidden rounded-2xl shadow-2xl flex-shrink-0 border border-purple-200/30 dark:border-gray-600/30">
            {/* Image with gradient overlays for depth */}
            <div className="absolute inset-0">
              <img
                src={character.imageUrl}
                alt={character.name}
                className="w-full h-full object-cover object-center"
                style={{
                  imageRendering: 'auto',
                  transform: 'translateZ(0)',
                  backfaceVisibility: 'hidden'
                }}
              />
              {/* Gradient overlays for sleek blending */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-purple-50/20 dark:to-gray-800/30"></div>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10 dark:to-black/30"></div>
              {/* Subtle vignette effect */}
              <div className="absolute inset-0 shadow-inner" style={{
                boxShadow: 'inset 0 0 100px rgba(0,0,0,0.1)'
              }}></div>
            </div>

            {/* Character name overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent backdrop-blur-sm p-5">
              <h2 className="text-xl font-bold text-white drop-shadow-lg">{character.name}</h2>
            </div>
          </div>
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
        selectedImage={selectedImage}
        setSelectedImage={setSelectedImage}
        imageDescription={imageDescription}
        setImageDescription={setImageDescription}
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
