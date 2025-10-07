import db from '../db/database.js';

class ConversationService {
  /**
   * Get all conversations for a user
   */
  getConversations(userId) {
    return db.prepare(`
      SELECT
        c.id,
        c.user_id,
        c.character_id,
        c.character_name,
        c.unread_count,
        c.created_at,
        c.updated_at,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
      FROM conversations c
      WHERE c.user_id = ?
      ORDER BY c.updated_at DESC
    `).all(userId);
  }

  /**
   * Get a conversation by user and character
   */
  getConversation(userId, characterId) {
    return db.prepare(`
      SELECT * FROM conversations
      WHERE user_id = ? AND character_id = ?
    `).get(userId, characterId);
  }

  /**
   * Get a conversation by ID
   */
  getConversationById(conversationId) {
    return db.prepare(`
      SELECT * FROM conversations WHERE id = ?
    `).get(conversationId);
  }

  /**
   * Get or create a conversation
   */
  getOrCreateConversation(userId, characterId, characterName = 'Character') {
    let conversation = this.getConversation(userId, characterId);

    if (!conversation) {
      const result = db.prepare(`
        INSERT INTO conversations (user_id, character_id, character_name)
        VALUES (?, ?, ?)
      `).run(userId, characterId, characterName);

      conversation = this.getConversationById(result.lastInsertRowid);
    }

    return conversation;
  }

  /**
   * Mark conversation as read (reset unread count)
   */
  markAsRead(userId, characterId) {
    const conversation = this.getConversation(userId, characterId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    db.prepare(`
      UPDATE conversations
      SET unread_count = 0
      WHERE id = ?
    `).run(conversation.id);

    return true;
  }

  /**
   * Delete a conversation and its messages
   */
  deleteConversation(userId, conversationId) {
    // Verify ownership
    const conversation = db.prepare(`
      SELECT * FROM conversations WHERE id = ? AND user_id = ?
    `).get(conversationId, userId);

    if (!conversation) {
      throw new Error('Conversation not found or unauthorized');
    }

    // Delete messages first (foreign key constraint)
    db.prepare(`DELETE FROM messages WHERE conversation_id = ?`).run(conversationId);

    // Delete conversation
    db.prepare(`DELETE FROM conversations WHERE id = ?`).run(conversationId);

    return true;
  }

  /**
   * Update conversation timestamp
   */
  updateTimestamp(conversationId) {
    db.prepare(`
      UPDATE conversations
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(conversationId);
  }

  /**
   * Increment unread count
   */
  incrementUnreadCount(conversationId) {
    db.prepare(`
      UPDATE conversations
      SET updated_at = CURRENT_TIMESTAMP,
          unread_count = unread_count + 1
      WHERE id = ?
    `).run(conversationId);
  }

  /**
   * Update timestamp and increment unread count (combined operation)
   */
  updateAndIncrementUnread(conversationId) {
    this.incrementUnreadCount(conversationId);
  }
}

export default new ConversationService();
