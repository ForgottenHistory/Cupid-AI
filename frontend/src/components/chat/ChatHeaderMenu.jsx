import { createPortal } from 'react-dom';

/**
 * Dropdown menu for chat header actions
 */
const ChatHeaderMenu = ({
  isOpen,
  position,
  onClose,
  messages,
  totalMessages,
  hasMoreMessages,
  conversationId,
  exporting,
  onExport,
  onPostInstructions,
  onOpenLibraryCard,
  onUnmatch
}) => {
  if (!isOpen) return null;

  // Calculate approximate token count (1 token ≈ 4 characters)
  const calculateTokens = () => {
    if (!messages || messages.length === 0) return 0;
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(totalChars / 4);
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[998]"
        onClick={onClose}
      />
      <div
        className="fixed bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-purple-100/50 dark:border-purple-900/50 rounded-xl shadow-xl py-1 min-w-[180px] z-[999]"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`
        }}
      >
        {/* Conversation Stats */}
        <div className="px-4 py-2.5 text-gray-700 dark:text-gray-300 text-sm border-b border-purple-100/50 dark:border-purple-900/50">
          <div className="flex items-center gap-2 font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Conversation</span>
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {hasMoreMessages ? (
              <>
                {messages.length.toLocaleString()} of {totalMessages.toLocaleString()} messages loaded
                <br />
                ~{calculateTokens().toLocaleString()} tokens (loaded)
              </>
            ) : (
              <>
                {totalMessages.toLocaleString()} {totalMessages === 1 ? 'message' : 'messages'}
                <br />
                ~{calculateTokens().toLocaleString()} tokens
              </>
            )}
          </div>
        </div>

        {/* Open Library Card */}
        <button
          onClick={() => {
            onClose();
            onOpenLibraryCard();
          }}
          className="w-full text-left px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all font-medium flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
          </svg>
          Library Card
        </button>

        {/* Post Instructions */}
        <button
          onClick={() => {
            onClose();
            onPostInstructions();
          }}
          className="w-full text-left px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all font-medium flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Post Instructions
        </button>

        {/* Export Chat */}
        <button
          onClick={onExport}
          disabled={exporting || !conversationId}
          className="w-full text-left px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {exporting ? 'Exporting...' : 'Export Chat'}
        </button>

        {/* Unmatch */}
        <button
          onClick={() => {
            onClose();
            onUnmatch();
          }}
          className="w-full text-left px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all font-medium flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 20 20">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          Unmatch
        </button>
      </div>
    </>,
    document.body
  );
};

export default ChatHeaderMenu;
