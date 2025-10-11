import { useState, useRef } from 'react';
import chatService from '../../services/chatService';
import Emoji from '../Emoji';

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
  selectedImage,
  setSelectedImage,
  imageDescription,
  setImageDescription,
}) => {
  const [loadingSuggestion, setLoadingSuggestion] = useState(null);
  const fileInputRef = useRef(null);

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

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setImageDescription(''); // Reset description when new image selected
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImageDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border-t border-purple-100/30 dark:border-gray-700/30 bg-gradient-to-b from-white/90 to-purple-50/30 dark:from-gray-800/90 dark:to-gray-900/30 backdrop-blur-md p-4 flex-shrink-0 shadow-lg">
      {/* AI Suggestion Buttons */}
      {hasMessages && (
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => handleSuggestion('serious')}
            disabled={loadingSuggestion !== null || sending}
            className="flex-1 px-4 py-2 bg-blue-50/80 dark:bg-blue-900/30 backdrop-blur-sm text-blue-700 dark:text-blue-300 rounded-xl hover:bg-blue-100/80 dark:hover:bg-blue-800/40 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm border border-blue-200/50 dark:border-blue-700/50 shadow-md hover:shadow-lg"
          >
            {loadingSuggestion === 'serious' ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
                <span>Generating...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5">
                <Emoji emoji="💼" size="1.1em" />
                <span>Serious</span>
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleSuggestion('sarcastic')}
            disabled={loadingSuggestion !== null || sending}
            className="flex-1 px-4 py-2 bg-purple-50/80 dark:bg-purple-900/30 backdrop-blur-sm text-purple-700 dark:text-purple-300 rounded-xl hover:bg-purple-100/80 dark:hover:bg-purple-800/40 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm border border-purple-200/50 dark:border-purple-700/50 shadow-md hover:shadow-lg"
          >
            {loadingSuggestion === 'sarcastic' ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 border-2 border-purple-700 border-t-transparent rounded-full animate-spin"></div>
                <span>Generating...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5">
                <Emoji emoji="😏" size="1.1em" />
                <span>Sarcastic</span>
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleSuggestion('flirty')}
            disabled={loadingSuggestion !== null || sending}
            className="flex-1 px-4 py-2 bg-pink-50/80 dark:bg-pink-900/30 backdrop-blur-sm text-pink-700 dark:text-pink-300 rounded-xl hover:bg-pink-100/80 dark:hover:bg-pink-800/40 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm border border-pink-200/50 dark:border-pink-700/50 shadow-md hover:shadow-lg"
          >
            {loadingSuggestion === 'flirty' ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 border-2 border-pink-700 border-t-transparent rounded-full animate-spin"></div>
                <span>Generating...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5">
                <Emoji emoji="💕" size="1.1em" />
                <span>Flirty</span>
              </div>
            )}
          </button>
        </div>
      )}

      {/* Image Preview and Description */}
      {selectedImage && (
        <div className="mb-3 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-3 border border-purple-200/30 dark:border-gray-600/30 shadow-md">
          <div className="flex gap-3">
            {/* Image Preview */}
            <div className="relative flex-shrink-0">
              <img
                src={URL.createObjectURL(selectedImage)}
                alt="Upload preview"
                className="w-20 h-20 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center justify-center shadow-md"
              >
                ✕
              </button>
            </div>
            {/* Description Input */}
            <div className="flex-1">
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Describe what's in the image
              </label>
              <input
                type="text"
                value={imageDescription}
                onChange={(e) => setImageDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && imageDescription.trim()) {
                    e.preventDefault();
                    onSend(e);
                  }
                }}
                placeholder="e.g., I am holding a red apple"
                className="w-full px-3 py-2 bg-white dark:bg-gray-600 border border-purple-200/30 dark:border-gray-500/30 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-purple-400 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />

      <form onSubmit={onSend} className="flex gap-3">
        {/* Image Upload Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          title="Upload image"
          className="px-4 py-3.5 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-700 dark:text-gray-300 rounded-full hover:bg-white dark:hover:bg-gray-600 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg border border-purple-100/30 dark:border-gray-600/30"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${characterName || 'character'}...`}
          className="flex-1 px-5 py-3.5 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border border-purple-200/30 dark:border-gray-600/30 rounded-full focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 focus:border-purple-400 dark:focus:border-purple-500 focus:bg-white dark:focus:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-all shadow-md focus:shadow-lg"
        />
        {hasMessages && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={sending || displayingMessages}
            title="Regenerate last response"
            className="px-4 py-3.5 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-700 dark:text-gray-300 rounded-full hover:bg-white dark:hover:bg-gray-600 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg border border-purple-100/30 dark:border-gray-600/30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
        <button
          type="submit"
          disabled={sending}
          className="px-7 py-3.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full hover:from-pink-600 hover:to-purple-700 hover:scale-105 active:scale-95 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-md"
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
