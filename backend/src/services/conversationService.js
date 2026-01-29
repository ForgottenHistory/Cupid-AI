import db from '../db/database.js';

class ConversationService {
  /**
   * Get all conversations for a user
   * Only returns conversations where the character is still matched (exists in characters table)
   */
  getConversations(userId) {
    return db.prepare(`
      SELECT
        c.id,
        c.user_id,
        c.character_id,
        c.character_name,
        c.unread_count,
        c.character_mood,
        c.created_at,
        c.updated_at,
        c.last_message,
        c.last_message_at
      FROM conversations c
      INNER JOIN characters ch ON ch.id = c.character_id AND ch.user_id = c.user_id
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
   * Detects rematch scenarios (existing conversation with messages) and adds REMATCH separator
   */
  getOrCreateConversation(userId, characterId, characterName = 'Character') {
    let conversation = this.getConversation(userId, characterId);

    if (!conversation) {
      // New match - create conversation
      const result = db.prepare(`
        INSERT INTO conversations (user_id, character_id, character_name)
        VALUES (?, ?, ?)
      `).run(userId, characterId, characterName);

      conversation = this.getConversationById(result.lastInsertRowid);
    } else {
      // Conversation already exists - check if this is a rematch scenario
      // A rematch occurs when the conversation has an UNMATCH separator as the last system message
      const lastSystemMessage = db.prepare(`
        SELECT content FROM messages
        WHERE conversation_id = ? AND role = 'system'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `).get(conversation.id);

      // Check if last system message is an UNMATCH separator
      if (lastSystemMessage && lastSystemMessage.content.startsWith('[UNMATCH:')) {
        // This is a REMATCH - add separator
        const rematchSeparator = `[REMATCH: You matched with ${characterName} again!]`;

        // Note: We can't use async/await here, so we insert the message directly
        db.prepare(`
          INSERT INTO messages (conversation_id, role, content, message_type, is_proactive)
          VALUES (?, ?, ?, ?, ?)
        `).run(conversation.id, 'system', rematchSeparator, 'text', 0);

        console.log(`✅ Added REMATCH separator: ${rematchSeparator}`);
      }
    }

    return conversation;
  }

  /**
   * Mark conversation as read (reset unread count and track when chat was opened)
   */
  markAsRead(userId, characterId) {
    const conversation = this.getConversation(userId, characterId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    db.prepare(`
      UPDATE conversations
      SET unread_count = 0,
          last_opened_at = CURRENT_TIMESTAMP
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
   * Refresh cached last_message from messages table (call after message deletion/edits)
   */
  refreshLastMessage(conversationId) {
    db.prepare(`
      UPDATE conversations SET
        last_message = (SELECT content FROM messages WHERE conversation_id = ? AND role != 'system' ORDER BY created_at DESC, id DESC LIMIT 1),
        last_message_at = (SELECT created_at FROM messages WHERE conversation_id = ? AND role != 'system' ORDER BY created_at DESC, id DESC LIMIT 1)
      WHERE id = ?
    `).run(conversationId, conversationId, conversationId);
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
