import db from '../db/database.js';
import timeGapService from './timeGapService.js';

class MessageService {
  /**
   * Convert SQLite timestamp to ISO format (append Z for UTC)
   */
  formatTimestamp(sqliteTimestamp) {
    if (!sqliteTimestamp) return sqliteTimestamp;
    // SQLite CURRENT_TIMESTAMP format: '2025-10-11 08:49:13'
    // Convert to ISO format: '2025-10-11T08:49:13Z'
    return sqliteTimestamp.replace(' ', 'T') + 'Z';
  }

  /**
   * Get all messages for a conversation
   */
  getMessages(conversationId) {
    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC, id ASC
    `).all(conversationId);

    // Convert timestamps to ISO format
    return messages.map(msg => ({
      ...msg,
      created_at: this.formatTimestamp(msg.created_at)
    }));
  }

  /**
   * Get paginated messages for a conversation (for frontend display)
   * Returns the LATEST messages by default, or older messages when offset is provided
   * @param {number} conversationId - Conversation ID
   * @param {number} limit - Number of messages to fetch (default 200)
   * @param {number} offset - Number of messages to skip from the end (default 0)
   * @returns {object} { messages: array, total: number, hasMore: boolean }
   */
  getMessagesPaginated(conversationId, limit = 200, offset = 0) {
    // Get total message count
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM messages WHERE conversation_id = ?
    `).get(conversationId);
    const total = countResult.total;

    // Get messages in reverse order (newest first), skip offset, take limit
    // Use id as tiebreaker to handle messages with identical timestamps (multi-line messages)
    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(conversationId, limit, offset);

    // Reverse to get chronological order (oldest first in the array)
    messages.reverse();

    // Convert timestamps to ISO format
    const formattedMessages = messages.map(msg => ({
      ...msg,
      created_at: this.formatTimestamp(msg.created_at)
    }));

    return {
      messages: formattedMessages,
      total: total,
      hasMore: (offset + limit) < total
    };
  }

  /**
   * Get message by ID
   */
  getMessage(messageId) {
    const message = db.prepare(`
      SELECT * FROM messages WHERE id = ?
    `).get(messageId);

    if (message) {
      message.created_at = this.formatTimestamp(message.created_at);
    }

    return message;
  }

  /**
   * Get message with conversation user_id for auth
   */
  getMessageWithUser(messageId) {
    return db.prepare(`
      SELECT m.*, c.user_id
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.id = ?
    `).get(messageId);
  }

  /**
   * Get conversation history as AI messages with session gap markers
   * TIME GAP markers are now pre-inserted into database, not calculated on-the-fly
   */
  getConversationHistory(conversationId) {
    const messages = db.prepare(`
      SELECT role, content, message_type, image_tags, gap_duration_hours FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC, id ASC
    `).all(conversationId);

    const result = [];
    let lastWasTimeGap = false;

    messages.forEach((msg) => {
      // Handle TIME GAP markers using message_type (no more string parsing!)
      if (timeGapService.isTimeGapMarker(msg)) {
        // Skip duplicate consecutive TIME GAP markers
        if (lastWasTimeGap) {
          return;
        }

        result.push({
          role: 'system',
          content: timeGapService.formatTimeGapContent(msg.gap_duration_hours)
        });
        lastWasTimeGap = true;
        return;
      }

      // Reset TIME GAP tracking when we hit a real message
      lastWasTimeGap = false;

      // Process message content
      let content = msg.content;

      // If message has image, convert to context format for AI
      if (msg.message_type === 'image') {
        if (msg.role === 'user') {
          // User image: Convert to [Image: description] format
          content = `[Image: ${msg.content}]`;
        } else {
          // AI image: Include image tags so the model knows what image was sent
          // Format: [IMAGE: tags] followed by the caption (if any)
          const textContent = content || '';
          const imageTags = msg.image_tags || '';
          if (imageTags) {
            content = textContent ? `[IMAGE: ${imageTags}]\n${textContent}` : `[IMAGE: ${imageTags}]`;
          } else {
            content = textContent || '[sent an image]';
          }
        }
      }

      result.push({
        role: msg.role,
        content: content
      });
    });

    return result;
  }

  /**
   * Save a message
   */
  saveMessage(conversationId, role, content, reaction = null, messageType = 'text', audioUrl = null, imageUrl = null, imageTags = null, isProactive = false, imagePrompt = null, reasoning = null) {
    const result = db.prepare(`
      INSERT INTO messages (conversation_id, role, content, reaction, message_type, audio_url, image_url, image_tags, is_proactive, image_prompt, reasoning)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(conversationId, role, content, reaction, messageType, audioUrl, imageUrl, imageTags, isProactive ? 1 : 0, imagePrompt, reasoning);

    // Update cached last_message on conversations table (skip system messages)
    if (role !== 'system') {
      db.prepare(`
        UPDATE conversations SET last_message = ?, last_message_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(content, conversationId);
    }

    return this.getMessage(result.lastInsertRowid);
  }

  /**
   * Edit a message (updates content and current swipe in swipes array)
   */
  editMessage(messageId, userId, content) {
    // Verify ownership
    const message = this.getMessageWithUser(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    if (message.user_id !== userId) {
      throw new Error('Unauthorized');
    }

    // If message has swipes, update the current swipe in the array
    let swipes = message.swipes ? JSON.parse(message.swipes) : null;
    if (swipes && swipes.length > 0) {
      const currentIndex = message.current_swipe || 0;
      swipes[currentIndex] = content;
    }

    // Update message
    db.prepare(`
      UPDATE messages
      SET content = ?, swipes = ?
      WHERE id = ?
    `).run(content, swipes ? JSON.stringify(swipes) : null, messageId);

    return true;
  }

  /**
   * Navigate to a different swipe variant
   * @param {number} messageId - Message ID
   * @param {number} userId - User ID for authorization
   * @param {number} swipeIndex - Index of swipe to navigate to
   * @returns {object} Updated message
   */
  setSwipeIndex(messageId, userId, swipeIndex) {
    const message = this.getMessageWithUser(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    if (message.user_id !== userId) {
      throw new Error('Unauthorized');
    }

    // Parse swipes array
    const swipes = message.swipes ? JSON.parse(message.swipes) : [message.content];

    if (swipeIndex < 0 || swipeIndex >= swipes.length) {
      throw new Error('Swipe index out of range');
    }

    // For image messages, swipes are objects with content, imageUrl, imagePrompt
    const isImageMessage = message.message_type === 'image';
    let newContent, newImageUrl, newImagePrompt;

    if (isImageMessage && typeof swipes[swipeIndex] === 'object') {
      newContent = swipes[swipeIndex].content;
      newImageUrl = swipes[swipeIndex].imageUrl;
      newImagePrompt = swipes[swipeIndex].imagePrompt;
    } else {
      newContent = swipes[swipeIndex];
      newImageUrl = message.image_url;
      newImagePrompt = message.image_prompt;
    }

    // Update content, currentSwipe index, and image fields for image messages
    db.prepare(`
      UPDATE messages
      SET content = ?, current_swipe = ?, image_url = ?, image_prompt = ?
      WHERE id = ?
    `).run(newContent, swipeIndex, newImageUrl, newImagePrompt, messageId);

    return this.getMessage(messageId);
  }

  /**
   * Add a new swipe variant to a message
   * @param {number} messageId - Message ID
   * @param {string} newContent - New content variant
   * @param {string|null} newReasoning - Reasoning for this variant (optional)
   * @returns {object} Updated message with new swipe count
   */
  addSwipe(messageId, newContent, newReasoning = null) {
    const message = this.getMessage(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    // Parse existing swipes (or create array from current content)
    let swipes = message.swipes ? JSON.parse(message.swipes) : [message.content];

    // Parse existing reasoning array
    let reasoningArray = [];
    if (message.reasoning) {
      try {
        const parsed = JSON.parse(message.reasoning);
        reasoningArray = Array.isArray(parsed) ? parsed : [message.reasoning];
      } catch {
        reasoningArray = [message.reasoning];
      }
    } else {
      // Fill with nulls for existing swipes without reasoning
      reasoningArray = new Array(swipes.length).fill(null);
    }

    // Append new variant
    swipes.push(newContent);
    reasoningArray.push(newReasoning);

    const newIndex = swipes.length - 1;

    // Update message
    db.prepare(`
      UPDATE messages
      SET content = ?, swipes = ?, current_swipe = ?, reasoning = ?
      WHERE id = ?
    `).run(newContent, JSON.stringify(swipes), newIndex, JSON.stringify(reasoningArray), messageId);

    return {
      message: this.getMessage(messageId),
      swipeCount: swipes.length,
      currentSwipe: newIndex
    };
  }

  /**
   * Add a new image swipe variant to a message
   * @param {number} messageId - Message ID
   * @param {string} newContent - New caption/content
   * @param {string} newImageUrl - New image URL
   * @param {string} newImagePrompt - New image prompt
   * @param {string|null} newReasoning - Reasoning for this variant (optional)
   * @returns {object} Updated message with new swipe count
   */
  addImageSwipe(messageId, newContent, newImageUrl, newImagePrompt, newReasoning = null) {
    const message = this.getMessage(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    // For image messages, store swipes as objects
    let swipes = [];
    if (message.swipes) {
      swipes = JSON.parse(message.swipes);
    } else {
      // Initialize with current message data as first swipe
      swipes = [{
        content: message.content,
        imageUrl: message.image_url,
        imagePrompt: message.image_prompt
      }];
    }

    // Parse existing reasoning array
    let reasoningArray = [];
    if (message.reasoning) {
      try {
        const parsed = JSON.parse(message.reasoning);
        reasoningArray = Array.isArray(parsed) ? parsed : [message.reasoning];
      } catch {
        reasoningArray = [message.reasoning];
      }
    } else {
      reasoningArray = new Array(swipes.length).fill(null);
    }

    // Append new variant as object
    swipes.push({
      content: newContent,
      imageUrl: newImageUrl,
      imagePrompt: newImagePrompt
    });
    reasoningArray.push(newReasoning);

    const newIndex = swipes.length - 1;

    // Update message with new image data
    db.prepare(`
      UPDATE messages
      SET content = ?, swipes = ?, current_swipe = ?, reasoning = ?, image_url = ?, image_prompt = ?
      WHERE id = ?
    `).run(newContent, JSON.stringify(swipes), newIndex, JSON.stringify(reasoningArray), newImageUrl, newImagePrompt, messageId);

    return {
      message: this.getMessage(messageId),
      swipeCount: swipes.length,
      currentSwipe: newIndex
    };
  }

  /**
   * Get swipe info for a message
   * @param {number} messageId - Message ID
   * @returns {object} { swipes: array, currentSwipe: number, total: number }
   */
  getSwipeInfo(messageId) {
    const message = this.getMessage(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    const swipes = message.swipes ? JSON.parse(message.swipes) : [message.content];
    const currentSwipe = message.current_swipe || 0;

    return {
      swipes,
      currentSwipe,
      total: swipes.length
    };
  }

  /**
   * Find the oldest compactable block in a conversation
   * Returns block boundaries for compacting OR deleting
   * @param {number} conversationId - Conversation ID
   * @param {number} keepRecentN - Number of recent messages to preserve uncompacted
   * @param {number} minBlockSize - Minimum messages required to generate a summary (otherwise just delete)
   * @returns {object|null} { startMessageId, endMessageId, messageCount, blockIndex, action: 'compact'|'delete' } or null if no suitable block
   */
  findOldestCompactableBlock(conversationId, keepRecentN = 30, minBlockSize = 15) {
    // Get all messages in chronological order (exclude system messages by message_type)
    const messages = db.prepare(`
      SELECT id, role, message_type, created_at
      FROM messages
      WHERE conversation_id = ?
      AND message_type NOT IN ('time_gap', 'summary')
      AND role != 'system'
      ORDER BY created_at ASC, id ASC
    `).all(conversationId);

    if (messages.length <= keepRecentN) {
      // Not enough messages to compact
      return null;
    }

    // Identify blocks by calculating time gaps between messages
    const blocks = [];
    let currentBlock = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      // Check if there's a time gap from previous message
      if (i > 0 && currentBlock.length > 0) {
        const prevMsg = messages[i - 1];
        const gapHours = timeGapService.calculateTimeGap(prevMsg.created_at, msg.created_at);

        // If gap is significant (30+ minutes), start a new block
        if (gapHours !== null) {
          blocks.push([...currentBlock]);
          currentBlock = [];
        }
      }

      currentBlock.push(msg);
    }

    // Add final block if any
    if (currentBlock.length > 0) {
      blocks.push(currentBlock);
    }

    if (blocks.length === 0) {
      return null;
    }

    // Calculate how many messages from the end to protect
    const protectedMessages = Math.min(keepRecentN, messages.length);

    // Find how many blocks from the end we need to keep to protect recent messages
    let messagesFromEnd = 0;
    let blocksToKeep = 0;

    for (let i = blocks.length - 1; i >= 0; i--) {
      messagesFromEnd += blocks[i].length;
      blocksToKeep++;

      if (messagesFromEnd >= protectedMessages) {
        break;
      }
    }

    // Find oldest unprotected block (small or large, doesn't matter)
    const compactableBlocks = blocks.slice(0, blocks.length - blocksToKeep);

    if (compactableBlocks.length === 0) {
      return null;
    }

    // Return the oldest block with appropriate action
    const oldestBlock = compactableBlocks[0];
    const action = oldestBlock.length >= minBlockSize ? 'compact' : 'delete';

    return {
      startMessageId: oldestBlock[0].id,
      endMessageId: oldestBlock[oldestBlock.length - 1].id,
      messageCount: oldestBlock.length,
      blockIndex: 0,
      action: action
    };
  }

  /**
   * Count existing summary slots in a conversation
   * Both actual summary messages and deleted blocks count as slots
   * @param {number} conversationId - Conversation ID
   * @returns {number} Number of summary slots used
   */
  countSummarySlots(conversationId) {
    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM messages
      WHERE conversation_id = ? AND message_type = 'summary'
    `).get(conversationId);

    return result.count || 0;
  }

  /**
   * Get the oldest summary message in a conversation
   * @param {number} conversationId - Conversation ID
   * @returns {object|null} Oldest summary message or null
   */
  getOldestSummary(conversationId) {
    return db.prepare(`
      SELECT *
      FROM messages
      WHERE conversation_id = ? AND message_type = 'summary'
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    `).get(conversationId);
  }

  /**
   * Delete a specific message
   * @param {number} messageId - Message ID to delete
   */
  deleteMessage(messageId) {
    db.prepare(`
      DELETE FROM messages WHERE id = ?
    `).run(messageId);
  }

  /**
   * Get all image data from assistant messages in a conversation
   * Used for image rotation display and gallery (independent of pagination)
   * @param {number} conversationId - Conversation ID
   * @returns {Object[]} Array of {url, prompt} objects
   */
  getAllImageUrls(conversationId) {
    const rows = db.prepare(`
      SELECT image_url, image_prompt FROM messages
      WHERE conversation_id = ?
        AND role = 'assistant'
        AND message_type = 'image'
        AND image_url IS NOT NULL
      ORDER BY created_at ASC, id ASC
    `).all(conversationId);

    return rows.map(row => ({
      url: row.image_url,
      prompt: row.image_prompt
    }));
  }

  /**
   * Delete a message and all messages after it
   */
  deleteFromMessage(messageId, userId) {
    // Get the message and verify ownership
    const message = this.getMessageWithUser(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    // Allow deletion if user owns the conversation (works for both user/assistant/system messages)
    if (message.user_id !== userId) {
      throw new Error('Unauthorized');
    }

    // Delete this message and all messages with higher IDs in the same conversation
    // Using ID instead of created_at because split messages have identical timestamps
    db.prepare(`
      DELETE FROM messages
      WHERE conversation_id = ?
        AND id >= ?
    `).run(message.conversation_id, messageId);

    return message.conversation_id;
  }
}

export default new MessageService();
