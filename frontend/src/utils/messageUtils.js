/**
 * Extract the actual message ID by removing -part-N suffix
 * @param {string|number} messageId - The message ID (potentially with -part-N suffix)
 * @returns {string} The actual message ID
 */
export const extractActualMessageId = (messageId) => {
  return messageId.toString().split('-part-')[0];
};

/**
 * Split message content into parts by newlines
 * @param {string} content - The message content
 * @returns {string[]} Array of message parts (trimmed, non-empty)
 */
export const splitMessageIntoParts = (content) => {
  return content.split('\n').filter(part => part.trim());
};

/**
 * Determine if timestamp should be shown for a message
 * User messages always show timestamp
 * Assistant multi-part messages only show timestamp on last part
 * @param {Object} message - The message object
 * @returns {boolean} Whether to show timestamp
 */
export const shouldShowTimestamp = (message) => {
  if (message.role === 'user') return true;

  // For assistant messages, check if it's not a multi-part or if it's the last part
  const isMultiPart = message.id?.toString().includes('-part-');
  return !isMultiPart || message.isLastPart;
};

/**
 * Format timestamp as relative time ("1 minute ago", "2 hours ago", etc.)
 * @param {string|number|Date} timestamp - The timestamp to format
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (timestamp) => {
  const now = new Date();

  // SQLite returns timestamps in "YYYY-MM-DD HH:MM:SS" format without timezone
  // We need to treat these as UTC timestamps
  let messageDate;
  if (typeof timestamp === 'string' && timestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
    // SQLite format - treat as UTC by appending 'Z'
    messageDate = new Date(timestamp.replace(' ', 'T') + 'Z');
  } else {
    messageDate = new Date(timestamp);
  }

  const diffMs = now - messageDate;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return diffDays === 1 ? 'yesterday' : `${diffDays} days ago`;
  } else {
    // For older messages, show the date
    return messageDate.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: now.getFullYear() !== messageDate.getFullYear() ? 'numeric' : undefined
    });
  }
};
