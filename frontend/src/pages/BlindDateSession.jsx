import { useState } from 'react';
import { getImageUrl } from '../services/api';
import { useActivitySession, PHASE, CHAT_DURATION } from '../hooks/useActivitySession';

// Reuse chat components
import MessageList from '../components/chat/MessageList';
import ChatInput from '../components/chat/ChatInput';

const BlindDateSession = ({ user, onBack }) => {
  const session = useActivitySession(user, 'blind');
  const [showReveal, setShowReveal] = useState(false);

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

  // Get first initial
  const firstInitial = characterName ? characterName.charAt(0).toUpperCase() + '.' : '?';

  // Get character image URL
  const getCharacterImageUrl = () => {
    if (!character?.imageUrl) return null;
    if (character.imageUrl.startsWith('data:')) return character.imageUrl;
    return getImageUrl(character.imageUrl);
  };

  // Handle back - reset and go to hub
  const handleBack = () => {
    resetSession();
    setShowReveal(false);
    onBack();
  };

  // Handle match action with reveal animation
  const handleRevealAndMatch = async () => {
    if (isMatch) {
      setShowReveal(true);
      // Wait for reveal animation then proceed
      setTimeout(() => {
        handleMatchAction();
      }, 2000);
    } else {
      handleMatchAction();
    }
  };

  // Create a "blind" character object for ChatHeader-like display
  const blindCharacter = character ? {
    ...character,
    name: firstInitial,
    // Keep other properties but we won't use imageUrl in blind mode
  } : null;

  // Render IDLE phase
  if (phase === PHASE.IDLE) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-rose-50 dark:from-gray-900 dark:to-gray-800 p-8">
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

          <div className="w-24 h-24 bg-gradient-to-br from-amber-500 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Blind Date
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Chat without seeing who you're talking to. You'll only see their first initial. If you both match, their identity will be revealed!
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={startSession}
            className="px-8 py-4 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold rounded-full hover:from-amber-600 hover:to-rose-600 transition shadow-lg hover:shadow-xl"
          >
            Start Blind Date
          </button>
        </div>
      </div>
    );
  }

  // Render LOADING phase
  if (phase === PHASE.LOADING) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-rose-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="animate-spin w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Finding your mystery match...</p>
      </div>
    );
  }

  // Render DECIDING phase (still blind)
  if (phase === PHASE.DECIDING) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-rose-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="text-center max-w-md">
          {/* Mystery silhouette */}
          <div className="w-32 h-32 rounded-full mx-auto mb-6 ring-4 ring-amber-500 shadow-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
            <span className="text-5xl font-bold text-white/80">{firstInitial}</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Time's Up!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your chat with <span className="font-medium text-amber-600 dark:text-amber-400">{firstInitial}</span> has ended.
            Would you like to reveal who they are?
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
                className="px-8 py-3 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-medium rounded-full hover:from-amber-600 hover:to-rose-600 transition"
              >
                Reveal & Match!
              </button>
            </div>
          )}

          {decidingCharacter && !characterDecision && (
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
              <p className="text-gray-600 dark:text-gray-400">
                {firstInitial} is deciding...
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render RESULT phase (reveal on match!)
  if (phase === PHASE.RESULT) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-rose-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="text-center max-w-md">
          {isMatch ? (
            <>
              {/* Reveal animation */}
              <div className="relative mb-8">
                <div className="w-32 h-32 mx-auto relative">
                  {/* Mystery overlay that fades out */}
                  <div className={`absolute inset-0 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center ring-4 ring-amber-500 shadow-xl transition-opacity duration-1000 ${showReveal ? 'opacity-0' : 'opacity-100'}`}>
                    <span className="text-5xl font-bold text-white/80">{firstInitial}</span>
                  </div>

                  {/* Actual image that fades in */}
                  {getCharacterImageUrl() && (
                    <img
                      src={getCharacterImageUrl()}
                      alt={characterName}
                      className={`w-32 h-32 rounded-full object-cover ring-4 ring-pink-500 shadow-xl transition-opacity duration-1000 ${showReveal ? 'opacity-100' : 'opacity-0'}`}
                    />
                  )}

                  <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-gradient-to-br from-amber-500 to-rose-500 rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </div>
                </div>
              </div>

              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-rose-500 mb-3">
                It's a Match!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                {showReveal ? (
                  <>Your mystery match was <span className="font-bold text-rose-500">{characterName}</span>!</>
                ) : (
                  'Click to reveal who you matched with!'
                )}
              </p>
              {characterReason && showReveal && (
                <p className="text-sm text-amber-600 dark:text-amber-400 italic mb-2">
                  "{characterReason}"
                </p>
              )}

              {!showReveal ? (
                <button
                  onClick={handleRevealAndMatch}
                  className="mt-6 px-8 py-4 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold rounded-full hover:from-amber-600 hover:to-rose-600 transition shadow-lg hover:shadow-xl animate-pulse"
                >
                  Reveal Identity
                </button>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                  Starting chat...
                </p>
              )}
            </>
          ) : (
            <>
              {/* No match - don't reveal identity */}
              <div className="w-32 h-32 rounded-full mx-auto mb-6 opacity-50 grayscale bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center">
                <span className="text-5xl font-bold text-white/50">{firstInitial}</span>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                No Match
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                {userDecision === 'no' && characterDecision === 'no' && "Neither of you wanted to match. Their identity remains a mystery!"}
                {userDecision === 'yes' && characterDecision === 'no' && `${firstInitial} wasn't feeling it. Their identity remains a mystery.`}
                {userDecision === 'no' && characterDecision === 'yes' && `${firstInitial} wanted to match, but you passed. Their identity remains a mystery.`}
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
                  onClick={() => { resetSession(); setShowReveal(false); }}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-medium rounded-full hover:from-amber-600 hover:to-rose-600 transition"
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

  // Render CHATTING phase (blind mode - no image, only initial)
  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-amber-50/30 to-rose-50/30 dark:from-gray-800/30 dark:to-gray-900/30 relative">
      {/* Timer Bar */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-b border-amber-100/50 dark:border-gray-700/50 shadow-sm relative z-20">
        <div className="px-6 py-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">TIME REMAINING</span>
              <div className={`px-3 py-1 rounded-full font-mono text-sm font-bold ${
                timeRemaining < 60000
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
                  : timeRemaining < 180000
                    ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
              }`}>
                {formatTime(timeRemaining)}
              </div>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              Blind Date
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                timeRemaining < 60000 ? 'bg-red-500' : timeRemaining < 180000 ? 'bg-yellow-500' : 'bg-amber-500'
              }`}
              style={{ width: `${(timeRemaining / CHAT_DURATION) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Blind Chat Header - Custom simple header */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-b border-amber-100/50 dark:border-gray-700/50 shadow-sm relative z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Back button */}
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Mystery avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center ring-2 ring-amber-500/50">
            <span className="text-lg font-bold text-white/80">{firstInitial}</span>
          </div>

          {/* Name and status */}
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900 dark:text-white">{firstInitial}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Mystery Match</p>
          </div>

          {/* Blind indicator */}
          <div className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-full">
            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Chat Area - NO character image panel */}
      <div className="flex-1 flex overflow-hidden p-4 relative z-10">
        {/* Left Side - Mystery silhouette instead of image */}
        <div className="relative overflow-hidden rounded-2xl shadow-2xl flex-shrink-0 border border-amber-200/30 dark:border-gray-600/30 w-[320px] bg-gradient-to-br from-gray-800 to-gray-900">
          {/* Mystery pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)'
            }}></div>
          </div>

          {/* Large initial */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-9xl font-bold text-white/20">{firstInitial}</span>
          </div>

          {/* Bottom overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-32">
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-40% via-black/20 to-transparent"></div>
            <div className="absolute bottom-5 left-5 right-5">
              <h2 className="text-xl font-bold text-white drop-shadow-lg">{firstInitial}</h2>
              <p className="text-sm text-white/60">Identity hidden</p>
            </div>
          </div>
        </div>

        {/* Right Side - Messages */}
        <div className="flex-1 flex flex-col min-w-0 ml-4">
          <MessageList
            messages={messages}
            character={blindCharacter}
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
          characterName={firstInitial}
          characterId={character?.id}
          character={blindCharacter}
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

export default BlindDateSession;
