import db from '../db/database.js';

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
      ORDER BY created_at ASC
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
    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
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
   */
  getConversationHistory(conversationId) {
    const messages = db.prepare(`
      SELECT role, content, message_type, image_tags, created_at FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversationId);

    const result = [];
    const SESSION_GAP_THRESHOLD = 30 * 60 * 1000; // 1 hour in milliseconds

    messages.forEach((msg, index) => {
      // Check for time gap with previous message
      // Skip if current message is already a TIME GAP marker (to avoid duplicates)
      if (index > 0 && !msg.content?.startsWith('[TIME GAP:')) {
        const prevMsg = messages[index - 1];
        const prevTime = new Date(prevMsg.created_at).getTime();
        const currentTime = new Date(msg.created_at).getTime();
        const gapMs = currentTime - prevTime;

        // If gap is significant (30+ minutes), insert session marker
        if (gapMs >= SESSION_GAP_THRESHOLD) {
          const gapHours = (gapMs / (1000 * 60 * 60)).toFixed(1);

          // Insert session gap marker as a system message
          result.push({
            role: 'system',
            content: `[TIME GAP: ${gapHours} hours - NEW CONVERSATION SESSION]`
          });
        }
      }

      // Process message content
      let content = msg.content;

      // If message has image, prepend context for AI
      if (msg.message_type === 'image') {
        if (msg.role === 'user') {
          // User image: Convert to [Image: description] format
          content = `[Image: ${msg.content}]`;
        } else if (msg.image_tags) {
          // AI image: Prepend image tags to content
          content = `[Sent image: ${msg.image_tags}]\n${content}`;
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
  saveMessage(conversationId, role, content, reaction = null, messageType = 'text', audioUrl = null, imageUrl = null, imageTags = null, isProactive = false, imagePrompt = null) {
    const result = db.prepare(`
      INSERT INTO messages (conversation_id, role, content, reaction, message_type, audio_url, image_url, image_tags, is_proactive, image_prompt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(conversationId, role, content, reaction, messageType, audioUrl, imageUrl, imageTags, isProactive ? 1 : 0, imagePrompt);

    return this.getMessage(result.lastInsertRowid);
  }

  /**
   * Edit a message
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

    // Update message
    db.prepare(`
      UPDATE messages
      SET content = ?
      WHERE id = ?
    `).run(content, messageId);

    return true;
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
    // Get all messages in chronological order (exclude system messages like TIME GAP/SUMMARY)
    const messages = db.prepare(`
      SELECT id, role, content, message_type, created_at
      FROM messages
      WHERE conversation_id = ? AND role != 'system'
      ORDER BY created_at ASC
    `).all(conversationId);

    if (messages.length <= keepRecentN) {
      // Not enough messages to compact
      return null;
    }

    // Identify blocks by calculating time gaps between messages
    const SESSION_GAP_THRESHOLD = 30 * 60 * 1000; // 30 minutes in milliseconds
    const blocks = [];
    let currentBlock = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      // Check if there's a time gap from previous message
      if (i > 0 && currentBlock.length > 0) {
        const prevMsg = messages[i - 1];
        const prevTime = new Date(prevMsg.created_at).getTime();
        const currentTime = new Date(msg.created_at).getTime();
        const gapMs = currentTime - prevTime;

        // If gap is significant (30+ minutes), start a new block
        if (gapMs >= SESSION_GAP_THRESHOLD) {
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
      ORDER BY created_at ASC
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

    // Delete this message and all messages created after it in the same conversation
    db.prepare(`
      DELETE FROM messages
      WHERE conversation_id = ?
        AND created_at >= (
          SELECT created_at FROM messages WHERE id = ?
        )
    `).run(message.conversation_id, messageId);

    return message.conversation_id;
  }
}

export default new MessageService();
