/**
 * System message notification (centered, gray text)
 * Used for background changes and other system events
 */
const SystemMessage = ({ content, onDelete, messageId }) => {

  const handleDelete = () => {
    console.log('🗑️ SystemMessage delete clicked, messageId:', messageId);
    // onDelete already has confirmation, just call it directly
    onDelete(messageId);
  };

  return (
    <div className="flex flex-col items-center py-3 px-4 group">
      <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-full shadow-sm">
        {content}
      </div>

      {/* Delete button - subtle, below message, shows on hover */}
      <button
        onClick={handleDelete}
        className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 flex items-center gap-1"
        title="Delete from here"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span>Delete</span>
      </button>
    </div>
  );
};

export default SystemMessage;
