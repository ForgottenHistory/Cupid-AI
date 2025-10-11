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
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
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
          />
        );
      })}

      {showTypingIndicator && <TypingIndicator characterName={character?.name} />}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
