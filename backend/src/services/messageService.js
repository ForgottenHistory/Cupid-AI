import db from '../db/database.js';

class MessageService {
  /**
   * Get all messages for a conversation
   */
  getMessages(conversationId) {
    return db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversationId);
  }

  /**
   * Get message by ID
   */
  getMessage(messageId) {
    return db.prepare(`
      SELECT * FROM messages WHERE id = ?
    `).get(messageId);
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
   * Get conversation history as AI messages
   */
  getConversationHistory(conversationId) {
    const messages = db.prepare(`
      SELECT role, content, message_type, image_tags FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversationId);

    return messages.map(msg => {
      let content = msg.content;

      // If message has image, prepend tags to content for AI context
      if (msg.message_type === 'image' && msg.image_tags) {
        content = `[Sent image: ${msg.image_tags}]\n${content}`;
      }

      return {
        role: msg.role,
        content: content
      };
    });
  }

  /**
   * Save a message
   */
  saveMessage(conversationId, role, content, reaction = null, messageType = 'text', audioUrl = null, imageUrl = null, imageTags = null) {
    const result = db.prepare(`
      INSERT INTO messages (conversation_id, role, content, reaction, message_type, audio_url, image_url, image_tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(conversationId, role, content, reaction, messageType, audioUrl, imageUrl, imageTags);

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
