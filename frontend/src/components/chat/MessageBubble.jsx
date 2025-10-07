import { shouldShowTimestamp } from '../../utils/messageUtils';

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
}) => {
  // Render edit mode
  if (isEditing) {
    return (
      <div className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
        {message.role === 'assistant' && <div className="w-12"></div>}

        <div className="max-w-[70%] space-y-2">
          <textarea
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            className="w-full px-4 py-3 bg-white/80 backdrop-blur-md border-2 border-purple-400/50 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white text-gray-900 resize-none shadow-lg transition-all"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={onCancelEdit}
              className="px-3 py-1.5 text-sm bg-white/60 backdrop-blur-sm text-gray-700 rounded-lg hover:bg-white/80 hover:scale-105 transition-all border border-gray-200/50 shadow-md"
            >
              Cancel
            </button>
            <button
              onClick={() => onSaveEdit(message.id)}
              className="px-3 py-1.5 text-sm bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 hover:scale-105 transition-all shadow-md hover:shadow-lg"
            >
              Save
            </button>
          </div>
        </div>

        {message.role === 'user' && <div className="w-12"></div>}
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
      {/* Action Buttons (left side for assistant, right side for user) */}
      {message.role === 'assistant' && (
        <div className="flex items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onStartEdit(message)}
            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50/80 backdrop-blur-sm rounded-lg hover:scale-110 transition-all shadow-sm hover:shadow-md border border-transparent hover:border-purple-200/50"
            title="Edit message"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(index)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50/80 backdrop-blur-sm rounded-lg hover:scale-110 transition-all shadow-sm hover:shadow-md border border-transparent hover:border-red-200/50"
            title="Delete from here"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={`relative max-w-[70%] rounded-2xl px-5 py-3 ${
          message.role === 'user'
            ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-200/50'
            : 'bg-white/80 backdrop-blur-md text-gray-900 shadow-lg shadow-gray-200/50 border border-purple-100/30'
        }`}
      >
        <p className="break-words leading-relaxed">{message.content}</p>
        {/* Show timestamp for user messages or last part of assistant multi-messages */}
        {shouldShowTimestamp(message) && (
          <p
            className={`text-xs mt-2 ${
              message.role === 'user' ? 'text-white/70' : 'text-gray-400'
            }`}
          >
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        )}

        {/* Reaction badge (show on user messages if next message is assistant with reaction) */}
        {message.role === 'user' && messages[index + 1]?.role === 'assistant' && messages[index + 1]?.reaction && (
          <div className="absolute -bottom-2 -right-2 text-lg bg-white/90 backdrop-blur-sm rounded-full px-1.5 py-0.5 shadow-lg border border-purple-200/50">
            {messages[index + 1].reaction}
          </div>
        )}
      </div>

      {/* Action Buttons (right side for user) */}
      {message.role === 'user' && (
        <div className="flex items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onStartEdit(message)}
            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50/80 backdrop-blur-sm rounded-lg hover:scale-110 transition-all shadow-sm hover:shadow-md border border-transparent hover:border-purple-200/50"
            title="Edit message"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(index)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50/80 backdrop-blur-sm rounded-lg hover:scale-110 transition-all shadow-sm hover:shadow-md border border-transparent hover:border-red-200/50"
            title="Delete from here"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
