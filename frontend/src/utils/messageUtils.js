/**
 * Determine if timestamp should be shown for a message
 * Always show timestamp for all messages
 * @param {Object} message - The message object
 * @returns {boolean} Whether to show timestamp
 */
export const shouldShowTimestamp = (message) => {
  return true;
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
