import { useState } from 'react';
import chatService from '../../services/chatService';

/**
 * Chat input component with send, regenerate, and AI suggestion buttons
 */
const ChatInput = ({
  input,
  setInput,
  sending,
  displayingMessages,
  hasMessages,
  characterName,
  characterId,
  character,
  inputRef,
  onSend,
  onRegenerate,
}) => {
  const [loadingSuggestion, setLoadingSuggestion] = useState(null);

  const handleSuggestion = async (style) => {
    if (loadingSuggestion || !hasMessages) return;

    try {
      setLoadingSuggestion(style);
      const response = await chatService.suggestReply(characterId, style, character.cardData?.data);
      setInput(response.suggestion);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to generate suggestion:', error);
    } finally {
      setLoadingSuggestion(null);
    }
  };

  return (
    <div className="border-t border-gray-200/50 bg-white/80 backdrop-blur-sm p-4 flex-shrink-0">
      {/* AI Suggestion Buttons */}
      {hasMessages && (
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => handleSuggestion('serious')}
            disabled={loadingSuggestion !== null || sending}
            className="flex-1 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm border border-blue-200"
          >
            {loadingSuggestion === 'serious' ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
                <span>Generating...</span>
              </div>
            ) : (
              '💼 Serious'
            )}
          </button>
          <button
            type="button"
            onClick={() => handleSuggestion('sarcastic')}
            disabled={loadingSuggestion !== null || sending}
            className="flex-1 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm border border-purple-200"
          >
            {loadingSuggestion === 'sarcastic' ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 border-2 border-purple-700 border-t-transparent rounded-full animate-spin"></div>
                <span>Generating...</span>
              </div>
            ) : (
              '😏 Sarcastic'
            )}
          </button>
          <button
            type="button"
            onClick={() => handleSuggestion('flirty')}
            disabled={loadingSuggestion !== null || sending}
            className="flex-1 px-4 py-2 bg-pink-50 text-pink-700 rounded-lg hover:bg-pink-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm border border-pink-200"
          >
            {loadingSuggestion === 'flirty' ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 border-2 border-pink-700 border-t-transparent rounded-full animate-spin"></div>
                <span>Generating...</span>
              </div>
            ) : (
              '💕 Flirty'
            )}
          </button>
        </div>
      )}

      <form onSubmit={onSend} className="flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${characterName || 'character'}...`}
          className="flex-1 px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-full focus:ring-2 focus:ring-purple-400 focus:border-transparent focus:bg-white text-gray-900 transition-all shadow-sm"
        />
        {hasMessages && (
          <button
            type="button"
            onClick={onRegenerate}
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
  );
};

export default ChatInput;
