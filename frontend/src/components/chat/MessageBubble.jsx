import { useState, useEffect, useRef } from 'react';
import { shouldShowTimestamp, formatRelativeTime } from '../../utils/messageUtils';
import AudioPlayer from './AudioPlayer';
import ImageModal from '../ImageModal';
import Emoji from '../Emoji';

/**
 * Swipe navigation controls for message variants
 */
const SwipeControls = ({ message, onSwipe, onRegenerate, isRegenerating }) => {
  // Parse swipes array
  const getSwipes = () => {
    if (!message.swipes) return [message.content];
    try {
      const swipes = JSON.parse(message.swipes);
      return Array.isArray(swipes) ? swipes : [message.content];
    } catch {
      return [message.content];
    }
  };

  const swipes = getSwipes();
  const currentIndex = message.current_swipe || 0;
  const totalSwipes = swipes.length;

  const handleLeft = () => {
    if (currentIndex > 0) {
      onSwipe(message.id, currentIndex - 1);
    } else {
      // Wrap to end
      onSwipe(message.id, totalSwipes - 1);
    }
  };

  const handleRight = () => {
    if (currentIndex < totalSwipes - 1) {
      // Move to next swipe
      onSwipe(message.id, currentIndex + 1);
    } else if (onRegenerate) {
      // At end, generate new swipe
      onRegenerate(message.id);
    } else {
      // Wrap to beginning
      onSwipe(message.id, 0);
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      {/* Left arrow */}
      <button
        onClick={handleLeft}
        disabled={isRegenerating}
        className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50/80 dark:hover:bg-purple-900/40 backdrop-blur-sm rounded-lg hover:scale-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Previous response"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Counter */}
      <span className="text-xs text-gray-400 dark:text-gray-500 min-w-[32px] text-center tabular-nums">
        {currentIndex + 1}/{totalSwipes}
      </span>

      {/* Right arrow (generates new at end) */}
      <button
        onClick={handleRight}
        disabled={isRegenerating}
        className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50/80 dark:hover:bg-purple-900/40 backdrop-blur-sm rounded-lg hover:scale-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title={currentIndex >= totalSwipes - 1 && onRegenerate ? "Generate new response" : "Next response"}
      >
        {isRegenerating ? (
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>
    </div>
  );
};

/**
 * Get the current reasoning for a message (handles swipe arrays)
 */
const getCurrentReasoning = (message) => {
  if (!message.reasoning) return null;

  try {
    const parsed = JSON.parse(message.reasoning);
    if (Array.isArray(parsed)) {
      const currentIndex = message.current_swipe || 0;
      return parsed[currentIndex] || null;
    }
    // If it's not an array, return as-is (legacy format)
    return message.reasoning;
  } catch {
    // If parsing fails, it's a plain string (legacy format)
    return message.reasoning;
  }
};

/**
 * Individual message bubble component
 */
const MessageBubble = ({
  message,
  index,
  messages,
  isNew,
  isEditing,
  editingText,
  setEditingText,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  imageModalOpen,
  setImageModalOpen,
  isLastAssistantMessage,
  onSwipe,
  onRegenerate,
  isRegenerating,
}) => {
  const [showImageModal, setShowImageModal] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [, setUpdateTrigger] = useState(0);
  const textareaRef = useRef(null);
  const initializedRef = useRef(false);

  // Update timestamps every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setUpdateTrigger(prev => prev + 1);
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Set initial content and focus when editing starts (only once per edit session)
  useEffect(() => {
    if (isEditing && textareaRef.current && !initializedRef.current) {
      const element = textareaRef.current;
      // Set initial text content
      element.textContent = editingText;
      element.focus();
      // Move cursor to end
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      initializedRef.current = true;
    } else if (!isEditing) {
      // Reset when exiting edit mode
      initializedRef.current = false;
    }
  }, [isEditing, editingText]);

  // Check if this is an image message
  const isImageMessage = message.message_type === 'image' && message.image_url;

  // Render edit mode
  if (isEditing) {
    return (
      <div className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
        {/* Action Buttons (left side for assistant, right side for user) */}
        {message.role === 'assistant' && (
          <div className="flex items-end gap-1 opacity-100 transition-opacity">
            <button
              onClick={onCancelEdit}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50/80 dark:hover:bg-gray-700/40 backdrop-blur-sm rounded-lg hover:scale-110 transition-all shadow-sm hover:shadow-md border border-transparent hover:border-gray-200/50 dark:hover:border-gray-600/50"
              title="Cancel edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              onClick={() => onSaveEdit(message.id)}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50/80 dark:hover:bg-green-900/40 backdrop-blur-sm rounded-lg hover:scale-110 transition-all shadow-sm hover:shadow-md border border-transparent hover:border-green-200/50 dark:hover:border-green-600/50"
              title="Save edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Message Bubble with contenteditable div */}
        <div
          className={`relative ${isImageMessage ? 'w-fit' : 'max-w-[70%]'} rounded-2xl px-5 py-3 ${
            message.role === 'user'
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 dark:from-purple-800 dark:to-purple-900 text-white shadow-lg shadow-pink-200/50 dark:shadow-purple-900/50 border border-pink-300/20 dark:border-purple-700/50'
              : 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-md text-gray-900 dark:text-gray-100 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/30 border border-purple-100/30 dark:border-gray-600/30'
          }`}
        >
          {/* For image messages, show the image (read-only) with editable caption */}
          {isImageMessage ? (
            <div className="space-y-2 w-[200px]">
              <img
                src={`http://localhost:3000${message.image_url}`}
                alt={message.role === 'user' ? "User uploaded image" : "AI-generated character image"}
                className="rounded-lg w-full h-auto shadow-md opacity-75"
              />
              <div
                ref={textareaRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => setEditingText(e.currentTarget.textContent)}
                className={`text-xs italic break-words leading-relaxed outline-none border-b border-dashed ${
                  message.role === 'user'
                    ? 'text-white/80 border-white/30'
                    : 'text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'
                }`}
                style={{ whiteSpace: 'pre-wrap', minHeight: '1.5em' }}
                placeholder="Add caption..."
              />
            </div>
          ) : (
            <div
              ref={textareaRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setEditingText(e.currentTarget.textContent)}
              className={`break-words leading-relaxed outline-none ${
                message.role === 'user' ? 'text-white' : 'text-gray-900 dark:text-gray-100'
              }`}
              style={{ whiteSpace: 'pre-wrap' }}
            />
          )}
        </div>

        {/* Action Buttons (right side for user) */}
        {message.role === 'user' && (
          <div className="flex items-end gap-1 opacity-100 transition-opacity">
            <button
              onClick={onCancelEdit}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50/80 dark:hover:bg-gray-700/40 backdrop-blur-sm rounded-lg hover:scale-110 transition-all shadow-sm hover:shadow-md border border-transparent hover:border-gray-200/50 dark:hover:border-gray-600/50"
              title="Cancel edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              onClick={() => onSaveEdit(message.id)}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50/80 dark:hover:bg-green-900/40 backdrop-blur-sm rounded-lg hover:scale-110 transition-all shadow-sm hover:shadow-md border border-transparent hover:border-green-200/50 dark:hover:border-green-600/50"
              title="Save edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Render normal message
  return (
    <div
      className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${
        isNew ? 'animate-slideUp' : ''
      } group`}
    >
      {/* Action Buttons (left side for assistant) - stacked vertically */}
      {message.role === 'assistant' && (
        <div className="flex flex-col items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity w-[92px]">
          {/* Swipe Controls (only for last assistant message) */}
          {isLastAssistantMessage && onSwipe && (
            <SwipeControls
              message={message}
              onSwipe={onSwipe}
              onRegenerate={onRegenerate}
              isRegenerating={isRegenerating}
            />
          )}
          {/* Edit & Delete buttons */}
          <div className="flex items-center gap-1 justify-center">
            <button
              onClick={() => onStartEdit(message)}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50/80 dark:hover:bg-purple-900/40 backdrop-blur-sm rounded-lg hover:scale-110 transition-all shadow-sm hover:shadow-md border border-transparent hover:border-purple-200/50 dark:hover:border-purple-600/50"
              title="Edit message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(index)}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-900/40 backdrop-blur-sm rounded-lg hover:scale-110 transition-all shadow-sm hover:shadow-md border border-transparent hover:border-red-200/50 dark:hover:border-red-600/50"
              title="Delete from here"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={`relative ${isImageMessage ? 'w-fit' : 'max-w-[70%]'} rounded-2xl px-5 py-3 ${
          message.role === 'user'
            ? 'bg-gradient-to-r from-pink-500 to-purple-600 dark:from-purple-800 dark:to-purple-900 text-white shadow-lg shadow-pink-200/50 dark:shadow-purple-900/50 border border-pink-300/20 dark:border-purple-700/50'
            : 'bg-white/80 dark:bg-gray-700/80 backdrop-blur-md text-gray-900 dark:text-gray-100 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/30 border border-purple-100/30 dark:border-gray-600/30'
        }`}
      >
        {/* Voice message, image message, or text message */}
        {message.message_type === 'voice' && message.audio_url ? (
          <AudioPlayer
            audioUrl={`http://localhost:3000${message.audio_url}`}
            showTranscript={true}
            transcript={message.content}
            role={message.role}
          />
        ) : isImageMessage ? (
          <div className="space-y-2 w-[200px]">
            <img
              src={`http://localhost:3000${message.image_url}`}
              alt={message.role === 'user' ? "User uploaded image" : "AI-generated character image"}
              className="rounded-lg w-full h-auto cursor-pointer hover:opacity-90 hover:scale-105 transition-all shadow-md"
              onClick={() => {
                setShowImageModal(true);
                setImageModalOpen(true);
              }}
              title="Click to view full size"
            />
            {message.content && (
              <Emoji
                emoji={message.content}
                className={`text-xs ${message.role === 'user' ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'} italic break-words`}
                size="0.9em"
              />
            )}
          </div>
        ) : (
          <Emoji emoji={message.content} className="break-words leading-relaxed" size="1.25em" />
        )}

        {/* Reasoning Display (only for assistant messages with reasoning) */}
        {message.role === 'assistant' && getCurrentReasoning(message) && (
          <div className="mt-3">
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
              <svg
                className={`w-3 h-3 transform transition-transform ${showReasoning ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {showReasoning ? 'Hide Reasoning' : 'View Reasoning'}
            </button>

            {showReasoning && (
              <div className="mt-2 p-3 bg-purple-50/50 dark:bg-purple-900/20 border border-purple-200/50 dark:border-purple-700/30 rounded-lg">
                <p className="text-xs text-purple-900 dark:text-purple-200 whitespace-pre-wrap break-words font-mono">
                  {getCurrentReasoning(message)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Show timestamp for user messages or last part of assistant multi-messages */}
        {shouldShowTimestamp(message) && (
          <p
            className={`text-xs mt-2 ${
              message.role === 'user' ? 'text-white/70' : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {formatRelativeTime(message.created_at)}
          </p>
        )}

        {/* Reaction badge (show on user messages if early reaction or next message is assistant with reaction) */}
        {message.role === 'user' && (message.earlyReaction || (messages[index + 1]?.role === 'assistant' && messages[index + 1]?.reaction)) && (
          <div className="absolute -bottom-2 -right-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full px-1.5 py-0.5 shadow-lg border border-purple-200/50 dark:border-gray-600/50">
            <Emoji emoji={message.earlyReaction || messages[index + 1].reaction} size="1.15em" />
          </div>
        )}
      </div>

      {/* Action Buttons (right side for user) */}
      {message.role === 'user' && (
        <div className="flex items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onStartEdit(message)}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50/80 dark:hover:bg-purple-900/40 backdrop-blur-sm rounded-lg hover:scale-110 transition-all shadow-sm hover:shadow-md border border-transparent hover:border-purple-200/50 dark:hover:border-purple-600/50"
            title="Edit message"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(index)}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-900/40 backdrop-blur-sm rounded-lg hover:scale-110 transition-all shadow-sm hover:shadow-md border border-transparent hover:border-red-200/50 dark:hover:border-red-600/50"
            title="Delete from here"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && isImageMessage && (
        <ImageModal
          imageUrl={`http://localhost:3000${message.image_url}`}
          imagePrompt={message.image_prompt}
          onClose={() => {
            setShowImageModal(false);
            setImageModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default MessageBubble;
