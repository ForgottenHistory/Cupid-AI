import db from '../db/database.js';
import messageService from './messageService.js';

/**
 * Shared service for processing AI responses
 * Used by messageProcessor.js and regenerate endpoints to avoid duplication
 */
class ResponseProcessorService {
  /**
   * Clean AI response content (em dashes, emojis on every 3rd message)
   */
  cleanContent(content, conversationId) {
    // Clean up em dashes (replace with periods and capitalize next letter)
    let cleaned = content.replace(/—\s*(.)/g, (_, char) => '. ' + char.toUpperCase());

    // Strip emojis from every 3rd assistant message to reduce repetition
    const assistantMessageCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM messages
      WHERE conversation_id = ? AND role = 'assistant'
    `).get(conversationId).count;

    // If this will be the 3rd, 6th, 9th, etc. message (count is 2, 5, 8, etc.)
    if ((assistantMessageCount + 1) % 3 === 0) {
      cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, '').trim();
      console.log(`🚫 Stripped emojis from message ${assistantMessageCount + 1} (every 3rd message)`);
    }

    return cleaned;
  }

  /**
   * Split content into parts by newlines
   */
  splitContent(content) {
    return content.split('\n').map(part => part.trim()).filter(part => part.length > 0);
  }

  /**
   * Check if content is a duplicate of recent messages
   * @param {string} content - The cleaned content to check
   * @param {Array} aiMessages - Array of previous messages with {role, content}
   * @param {number} lookbackCount - How many assistant messages to check against (default 5)
   * @returns {boolean} True if duplicate found
   */
  isDuplicate(content, aiMessages, lookbackCount = 5) {
    const contentParts = this.splitContent(content);
    const firstPart = contentParts[0] || content;
    const lastAiMessages = aiMessages.filter(msg => msg.role === 'assistant').slice(-lookbackCount);

    // Check both full content AND first part (since multi-line responses get split when saved)
    return lastAiMessages.some(msg => msg.content === content || msg.content === firstPart);
  }

  /**
   * Validate content is not empty
   */
  isEmpty(content) {
    const parts = this.splitContent(content);
    return parts.length === 0 || !parts[0];
  }

  /**
   * Get retry settings for a user
   */
  getRetrySettings(userId) {
    const settings = db.prepare('SELECT retry_on_invalid_response FROM users WHERE id = ?').get(userId);
    const enabled = settings?.retry_on_invalid_response === 1;
    return {
      enabled,
      maxRetries: enabled ? 3 : 1
    };
  }

  /**
   * Process AI response with retry logic for invalid responses
   * @param {Object} options
   * @param {Function} options.generateFn - Async function that generates AI response, returns {content, ...}
   * @param {number} options.conversationId - Conversation ID for emoji stripping
   * @param {Array} options.aiMessages - Previous messages for duplicate checking
   * @param {number} options.userId - User ID for retry settings
   * @param {string} options.characterName - Character name for logging
   * @returns {Object} {cleanedContent, contentParts, aiResponse}
   */
  async processWithRetry({ generateFn, conversationId, aiMessages, userId, characterName }) {
    const { enabled, maxRetries } = this.getRetrySettings(userId);
    console.log(`🔄 Retry setting: ${enabled} (maxRetries: ${maxRetries})`);

    let lastError = null;
    let aiResponse = null;
    let cleanedContent = null;
    let contentParts = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Generate AI response
        aiResponse = await generateFn();

        // Clean content
        cleanedContent = this.cleanContent(aiResponse.content, conversationId);

        // Split into parts
        contentParts = this.splitContent(cleanedContent);

        // Validate not empty
        if (this.isEmpty(cleanedContent)) {
          throw new Error('AI generated empty response');
        }

        // Check for duplicates
        if (this.isDuplicate(cleanedContent, aiMessages)) {
          throw new Error('AI generated duplicate response');
        }

        // Success - return result
        return { cleanedContent, contentParts, aiResponse };

      } catch (error) {
        // Check for retryable errors (our own and from aiService)
        const isRetryableError = error.message === 'AI generated empty response' ||
                                 error.message === 'AI generated duplicate response' ||
                                 error.message?.includes('empty after stripping') ||
                                 error.message?.includes('only character name prefix');

        if (isRetryableError && attempt < maxRetries) {
          console.warn(`⚠️ ${characterName}: ${error.message} (attempt ${attempt}/${maxRetries}). Retrying...`);
          lastError = error;
          continue;
        }

        // Not retryable or out of retries
        console.warn(`⚠️ ${characterName}: ${error.message}`);
        throw error;
      }
    }

    // Should not reach here, but just in case
    throw lastError || new Error('Failed to get valid response after retries');
  }

  /**
   * Save message parts to database
   * @param {Object} options
   * @param {number} options.conversationId
   * @param {Array} options.contentParts - Split message parts
   * @param {Object} options.firstMessageOptions - Options for first message (reaction, messageType, audioUrl, imageUrl, imageTags, isProactive, imagePrompt, reasoning)
   * @returns {Array} Array of saved messages
   */
  saveMessageParts({ conversationId, contentParts, firstMessageOptions = {} }) {
    const {
      reaction = null,
      messageType = 'text',
      audioUrl = null,
      imageUrl = null,
      imageTags = null,
      isProactive = false,
      imagePrompt = null,
      reasoning = null
    } = firstMessageOptions;

    const savedMessages = [];

    // Save first part with all metadata
    const firstMessage = messageService.saveMessage(
      conversationId,
      'assistant',
      contentParts[0],
      reaction,
      messageType,
      audioUrl,
      imageUrl,
      imageTags,
      isProactive,
      imagePrompt,
      reasoning
    );
    savedMessages.push(firstMessage);

    // Save subsequent parts as separate text messages
    for (let i = 1; i < contentParts.length; i++) {
      const msg = messageService.saveMessage(
        conversationId,
        'assistant',
        contentParts[i],
        null, // no reaction on subsequent messages
        'text', // always text
        null, // no audio
        null, // no image
        null, // no image tags
        isProactive,
        null, // no image prompt
        null // no reasoning
      );
      savedMessages.push(msg);
    }

    return savedMessages;
  }
}

export default new ResponseProcessorService();
