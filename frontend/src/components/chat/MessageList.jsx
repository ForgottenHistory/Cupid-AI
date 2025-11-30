import { useRef, useEffect, useLayoutEffect } from 'react';
import MessageBubble from './MessageBubble';
import SystemMessage from './SystemMessage';
import TypingIndicator from './TypingIndicator';

/**
 * Message list component that renders all messages and typing indicator
 */
const MessageList = ({
  messages,
  character,
  showTypingIndicator,
  newMessageIds,
  editingMessageId,
  editingText,
  setEditingText,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDeleteFrom,
  messagesEndRef,
  imageModalOpen,
  setImageModalOpen,
  hasMoreMessages = false,
  loadingMore = false,
  onLoadMore,
  totalMessages = 0,
  onSwipe,
  onRegenerate,
  isRegenerating,
}) => {
  const containerRef = useRef(null);
  const scrollPositionRef = useRef({ scrollTop: 0, scrollHeight: 0, messagesLength: 0 });
  const isLoadingMoreRef = useRef(false);

  // Preserve scroll position when loading older messages
  // Use useLayoutEffect to run synchronously before browser paint
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if messages were prepended (length increased and we're loading more)
    const previousLength = scrollPositionRef.current.messagesLength;
    const lengthIncreased = messages.length > previousLength;

    console.log('📜 MessageList scroll check:', {
      isLoadingMore: isLoadingMoreRef.current,
      previousLength,
      currentLength: messages.length,
      lengthIncreased,
      willAdjust: isLoadingMoreRef.current && previousLength > 0 && lengthIncreased
    });

    if (isLoadingMoreRef.current && previousLength > 0 && lengthIncreased) {
      // Messages were added - restore scroll position adjusted for new content
      const oldScrollHeight = scrollPositionRef.current.scrollHeight;
      const oldScrollTop = scrollPositionRef.current.scrollTop;
      const newScrollHeight = container.scrollHeight;
      const heightDiff = newScrollHeight - oldScrollHeight;

      // Restore position: add the height difference to previous scroll position
      container.scrollTop = oldScrollTop + heightDiff;

      console.log(`📜 Scroll preserved: was ${oldScrollTop}, now ${container.scrollTop} (added ${heightDiff}px)`);

      // Reset flag
      isLoadingMoreRef.current = false;
    }

    // Update stored values
    scrollPositionRef.current = {
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
      messagesLength: messages.length
    };
  }, [messages]);

  const handleLoadMore = () => {
    if (onLoadMore && !loadingMore && hasMoreMessages) {
      // Store current scroll position BEFORE loading
      const container = containerRef.current;
      if (container) {
        scrollPositionRef.current = {
          scrollTop: container.scrollTop,
          scrollHeight: container.scrollHeight,
          messagesLength: messages.length
        };
        // Set flag to indicate we're loading more (so we know to preserve scroll)
        isLoadingMoreRef.current = true;
      }
      onLoadMore();
    }
  };

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
      {/* Load More Button */}
      {hasMoreMessages && (
        <div className="flex justify-center py-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-2.5 bg-white dark:bg-gray-800 border-2 border-purple-500 dark:border-purple-600 text-purple-600 dark:text-purple-400 rounded-full font-medium shadow-md hover:bg-purple-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {loadingMore ? (
              <>
                <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Loading...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                <span>Load 200 more messages ({messages.length}/{totalMessages})</span>
              </>
            )}
          </button>
        </div>
      )}

      {messages.map((message, index) => {
        // Render system messages as centered notifications
        if (message.role === 'system') {
          return (
            <SystemMessage
              key={message.id || index}
              content={message.content}
              messageId={String(message.id)} // Convert to string so it's not treated as array index
              onDelete={onDeleteFrom}
            />
          );
        }

        // Find last assistant message index
        const lastAssistantIndex = messages.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i !== -1).pop();
        const isLastAssistantMessage = index === lastAssistantIndex;

        // Render regular messages as bubbles
        return (
          <MessageBubble
            key={message.id || index}
            message={message}
            index={index}
            messages={messages}
            isNew={newMessageIds.has(message.id)}
            isEditing={editingMessageId === message.id}
            editingText={editingText}
            setEditingText={setEditingText}
            onStartEdit={onStartEdit}
            onCancelEdit={onCancelEdit}
            onSaveEdit={onSaveEdit}
            onDelete={onDeleteFrom}
            imageModalOpen={imageModalOpen}
            setImageModalOpen={setImageModalOpen}
            isLastAssistantMessage={isLastAssistantMessage}
            onSwipe={onSwipe}
            onRegenerate={onRegenerate}
            isRegenerating={isRegenerating}
          />
        );
      })}

      {showTypingIndicator && <TypingIndicator characterName={character?.name} />}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
