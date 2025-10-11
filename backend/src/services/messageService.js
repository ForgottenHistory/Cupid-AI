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
      if (index > 0) {
        const prevMsg = messages[index - 1];
        const prevTime = new Date(prevMsg.created_at).getTime();
        const currentTime = new Date(msg.created_at).getTime();
        const gapMs = currentTime - prevTime;

        // If gap is significant (1+ hours), insert session marker
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
