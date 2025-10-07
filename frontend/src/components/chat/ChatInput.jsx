/**
 * Chat input component with send and regenerate buttons
 */
const ChatInput = ({
  input,
  setInput,
  sending,
  displayingMessages,
  hasMessages,
  characterName,
  inputRef,
  onSend,
  onRegenerate,
}) => {
  return (
    <div className="border-t border-gray-200/50 bg-white/80 backdrop-blur-sm p-4 flex-shrink-0">
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
