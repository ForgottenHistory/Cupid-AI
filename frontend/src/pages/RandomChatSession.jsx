import { getImageUrl } from '../services/api';
import { useActivitySession, PHASE, CHAT_DURATION } from '../hooks/useActivitySession';

// Reuse chat components
import MessageList from '../components/chat/MessageList';
import ChatInput from '../components/chat/ChatInput';
import ChatHeader from '../components/chat/ChatHeader';

const RandomChatSession = ({ user, onBack }) => {
  const session = useActivitySession(user, 'random');

  const {
    inputRef,
    messagesEndRef,
    phase,
    error,
    character,
    messages,
    input,
    setInput,
    sending,
    showTypingIndicator,
    editingMessageId,
    editingText,
    setEditingText,
    messageSwipes,
    messageSwipeIndex,
    isRegenerating,
    timeRemaining,
    userDecision,
    characterDecision,
    characterReason,
    decidingCharacter,
    characterStatus,
    characterName,
    isMatch,
    startSession,
    handleSend,
    handleUserDecision,
    handleMatchAction,
    resetSession,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleDeleteFrom,
    handleSwipe,
    handleRegenerate,
    handleSuggestReply,
    formatTime,
  } = session;

  // Get character image URL
  const getCharacterImageUrl = () => {
    if (!character?.imageUrl) return null;
    if (character.imageUrl.startsWith('data:')) return character.imageUrl;
    return getImageUrl(character.imageUrl);
  };

  // Handle back - reset and go to hub
  const handleBack = () => {
    resetSession();
    onBack();
  };

  // Render IDLE phase
  if (phase === PHASE.IDLE) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="text-center max-w-md">
          {/* Back button */}
          <button
            onClick={handleBack}
            className="absolute top-4 left-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="w-24 h-24 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Random Chat
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Chat with a random character for 10 minutes. At the end, both of you decide whether to match. If you both say yes, it's a match!
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={startSession}
            className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-full hover:from-pink-600 hover:to-purple-700 transition shadow-lg hover:shadow-xl"
          >
            Start Random Chat
          </button>
        </div>
      </div>
    );
  }

  // Render LOADING phase
  if (phase === PHASE.LOADING) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Finding someone for you...</p>
      </div>
    );
  }

  // Render DECIDING phase
  if (phase === PHASE.DECIDING) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="text-center max-w-md">
          {getCharacterImageUrl() && (
            <img
              src={getCharacterImageUrl()}
              alt={characterName}
              className="w-32 h-32 rounded-full object-cover mx-auto mb-6 ring-4 ring-purple-500 shadow-xl"
            />
          )}

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Time's Up!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your chat with <span className="font-medium text-purple-600 dark:text-purple-400">{characterName}</span> has ended.
            Would you like to match with them?
          </p>

          {!userDecision && !decidingCharacter && (
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => handleUserDecision('no')}
                className="px-8 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Pass
              </button>
              <button
                onClick={() => handleUserDecision('yes')}
                className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-medium rounded-full hover:from-pink-600 hover:to-purple-700 transition"
              >
                Match!
              </button>
            </div>
          )}

          {decidingCharacter && !characterDecision && (
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
              <p className="text-gray-600 dark:text-gray-400">
                {characterName} is deciding...
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render RESULT phase
  if (phase === PHASE.RESULT) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="text-center max-w-md">
          {isMatch ? (
            <>
              <div className="relative mb-8">
                <div className="w-32 h-32 mx-auto relative">
                  {getCharacterImageUrl() && (
                    <img
                      src={getCharacterImageUrl()}
                      alt={characterName}
                      className="w-32 h-32 rounded-full object-cover ring-4 ring-pink-500 animate-pulse shadow-xl"
                    />
                  )}
                  <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </div>
                </div>
              </div>

              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 mb-3">
                It's a Match!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                You and {characterName} both wanted to connect!
              </p>
              {characterReason && (
                <p className="text-sm text-purple-600 dark:text-purple-400 italic mb-8">
                  "{characterReason}"
                </p>
              )}
              {!characterReason && <div className="mb-8" />}

              <button
                onClick={handleMatchAction}
                className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-full hover:from-pink-600 hover:to-purple-700 transition shadow-lg hover:shadow-xl"
              >
                Start Chatting
              </button>
            </>
          ) : (
            <>
              {getCharacterImageUrl() && (
                <img
                  src={getCharacterImageUrl()}
                  alt={characterName}
                  className="w-32 h-32 rounded-full object-cover mx-auto mb-6 opacity-50 grayscale"
                />
              )}

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                No Match
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                {userDecision === 'no' && characterDecision === 'no' && "Neither of you wanted to match. That's okay!"}
                {userDecision === 'yes' && characterDecision === 'no' && `${characterName} wasn't feeling it this time.`}
                {userDecision === 'no' && characterDecision === 'yes' && `${characterName} wanted to match, but you passed.`}
              </p>
              {characterReason && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-2">
                  "{characterReason}"
                </p>
              )}
              <p className="text-gray-500 dark:text-gray-500 text-sm mb-8">
                Try again with someone new!
              </p>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleBack}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                  Back to Activities
                </button>
                <button
                  onClick={resetSession}
                  className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-medium rounded-full hover:from-pink-600 hover:to-purple-700 transition"
                >
                  Try Again
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Render CHATTING phase
  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-purple-50/30 to-pink-50/30 dark:from-gray-800/30 dark:to-gray-900/30 relative">
      {/* Timer Bar */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-b border-purple-100/50 dark:border-gray-700/50 shadow-sm relative z-20">
        <div className="px-6 py-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">TIME REMAINING</span>
              <div className={`px-3 py-1 rounded-full font-mono text-sm font-bold ${
                timeRemaining < 60000
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
                  : timeRemaining < 180000
                    ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
              }`}>
                {formatTime(timeRemaining)}
              </div>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              Random Chat
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                timeRemaining < 60000 ? 'bg-red-500' : timeRemaining < 180000 ? 'bg-yellow-500' : 'bg-purple-500'
              }`}
              style={{ width: `${(timeRemaining / CHAT_DURATION) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Chat Header */}
      {character && (
        <div className="relative z-10">
          <ChatHeader
            character={character}
            characterStatus={characterStatus}
            characterMood={null}
            characterState={null}
            messages={messages}
            totalMessages={messages.length}
            hasMoreMessages={false}
            onBack={handleBack}
            onUnmatch={() => {}}
            conversationId={null}
            onMoodUpdate={() => {}}
            onStateUpdate={() => {}}
            onCharacterUpdate={() => {}}
          />
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex overflow-hidden gap-4 p-4 relative z-10">
        {/* Left Side - Character Image */}
        {character && (
          <div className="relative overflow-hidden rounded-2xl shadow-2xl flex-shrink-0 border border-purple-200/30 dark:border-gray-600/30 w-[320px]">
            <div className="absolute inset-0">
              <img
                src={getCharacterImageUrl() || ''}
                alt={characterName}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-purple-50/20 dark:to-gray-800/30"></div>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10 dark:to-black/30"></div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-32">
              <div className="absolute inset-0 backdrop-blur-sm" style={{
                maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0) 100%)',
                WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0) 100%)'
              }}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-40% via-black/20 to-transparent"></div>
              <div className="absolute bottom-5 left-5 right-5">
                <h2 className="text-xl font-bold text-white drop-shadow-lg">{characterName}</h2>
              </div>
            </div>
          </div>
        )}

        {/* Right Side - Messages */}
        <div className="flex-1 flex flex-col min-w-0">
          <MessageList
            messages={messages}
            character={character}
            showTypingIndicator={showTypingIndicator}
            newMessageIds={new Set()}
            editingMessageId={editingMessageId}
            editingText={editingText}
            setEditingText={setEditingText}
            onStartEdit={handleStartEdit}
            onCancelEdit={handleCancelEdit}
            onSaveEdit={handleSaveEdit}
            onDeleteFrom={handleDeleteFrom}
            messagesEndRef={messagesEndRef}
            imageModalOpen={false}
            setImageModalOpen={() => {}}
            hasMoreMessages={false}
            loadingMore={false}
            onLoadMore={() => {}}
            totalMessages={messages.length}
            onSwipe={handleSwipe}
            onRegenerate={handleRegenerate}
            isRegenerating={isRegenerating}
            messageSwipes={messageSwipes}
            messageSwipeIndex={messageSwipeIndex}
          />

          {/* Error Display */}
          {error && (
            <div className="px-6 py-2">
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm shadow-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {error}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="relative z-10">
        <ChatInput
          input={input}
          setInput={setInput}
          sending={sending}
          displayingMessages={false}
          hasMessages={messages.length > 0}
          characterName={characterName}
          characterId={character?.id}
          character={character}
          inputRef={inputRef}
          onSend={handleSend}
          onRegenerate={() => {}}
          selectedImage={null}
          setSelectedImage={() => {}}
          imageDescription=""
          setImageDescription={() => {}}
          onSuggestReply={handleSuggestReply}
        />
      </div>
    </div>
  );
};

export default RandomChatSession;
