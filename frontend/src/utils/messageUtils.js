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
