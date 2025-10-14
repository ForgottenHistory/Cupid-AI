import db from '../db/database.js';
import conversationService from './conversationService.js';

class AutoUnmatchService {
  /**
   * Find inactive conversations that should be auto-unmatched
   * Returns array of { userId, characterId, conversationId, characterName, inactiveDays, threshold }
   */
  findInactiveConversations() {
    const inactiveConversations = [];

    // Get all users with auto-unmatch enabled (days > 0)
    const users = db.prepare(`
      SELECT id, auto_unmatch_inactive_days
      FROM users
      WHERE auto_unmatch_inactive_days > 0
    `).all();

    console.log(`🔍 Checking ${users.length} users with auto-unmatch enabled`);

    for (const user of users) {
      const threshold = user.auto_unmatch_inactive_days;
      const thresholdMs = threshold * 24 * 60 * 60 * 1000; // Convert days to milliseconds

      // Get all conversations for this user
      const conversations = db.prepare(`
        SELECT c.id, c.character_id, c.updated_at, c.character_name
        FROM conversations c
        WHERE c.user_id = ?
      `).all(user.id);

      for (const conversation of conversations) {
        const lastActivity = new Date(conversation.updated_at);
        const now = new Date();
        const inactiveMs = now - lastActivity;
        const inactiveDays = Math.floor(inactiveMs / (24 * 60 * 60 * 1000));

        // Check if conversation is inactive beyond threshold
        if (inactiveMs >= thresholdMs) {
          // Get character details for better logging
          const character = db.prepare(`
            SELECT card_data FROM characters WHERE id = ? AND user_id = ?
          `).get(conversation.character_id, user.id);

          let characterName = conversation.character_name || 'Character';
          if (character) {
            try {
              const cardData = JSON.parse(character.card_data);
              characterName = cardData.data?.name || cardData.name || characterName;
            } catch (e) {
              // Use fallback name if parsing fails
            }
          }

          inactiveConversations.push({
            userId: user.id,
            characterId: conversation.character_id,
            conversationId: conversation.id,
            characterName: characterName,
            inactiveDays: inactiveDays,
            threshold: threshold
          });

          console.log(`💔 Found inactive conversation: User ${user.id} + ${characterName} (${inactiveDays} days inactive, threshold: ${threshold} days)`);
        }
      }
    }

    return inactiveConversations;
  }

  /**
   * Auto-unmatch an inactive conversation
   * Preserves conversation history, adds separator, deletes character, emits WebSocket event
   */
  async autoUnmatch(inactiveConversation, io) {
    try {
      const { userId, characterId, conversationId, characterName, inactiveDays, threshold } = inactiveConversation;

      console.log(`💔 Auto-unmatch: User ${userId}, Character "${characterName}" (${inactiveDays} days inactive, threshold: ${threshold} days)`);

      const unmatchReason = `You and ${characterName} have been automatically unmatched due to ${inactiveDays} days of inactivity.`;

      // Add UNMATCH separator to conversation history (preserve memory)
      const unmatchSeparator = `[UNMATCH: ${characterName} unmatched - ${unmatchReason}]`;

      // Import messageService to save separator
      const messageService = (await import('./messageService.js')).default;
      messageService.saveMessage(
        conversationId,
        'system',
        unmatchSeparator,
        null, // no reaction
        'text',
        null, // no audio
        null, // no image
        null, // no image tags
        false, // not proactive
        null  // no image prompt
      );
      console.log(`✅ Added UNMATCH separator: ${unmatchSeparator}`);

      // Delete character from backend (removes match, but keeps conversation)
      // CASCADE will handle character_states, posts
      db.prepare(`
        DELETE FROM characters WHERE id = ? AND user_id = ?
      `).run(characterId, userId);

      // Emit unmatch event to frontend
      io.to(`user:${userId}`).emit('character_unmatched', {
        characterId,
        characterName,
        reason: unmatchReason
      });

      console.log(`✅ Auto-unmatch complete: ${characterName} unmatched from user ${userId} (conversation preserved)`);
      return true;
    } catch (error) {
      console.error('❌ Auto-unmatch error:', error.message);
      console.error('Stack:', error.stack);
      return false;
    }
  }

  /**
   * Run the auto-unmatch checker
   * Called every 60 minutes by interval in server.js
   * @param {Object} io - Socket.io instance
   */
  async checkAndUnmatch(io) {
    try {
      console.log('🔍 Checking for inactive conversations to auto-unmatch...');

      const inactiveConversations = this.findInactiveConversations();

      if (inactiveConversations.length === 0) {
        console.log('✅ No inactive conversations found');
        return;
      }

      console.log(`📋 Found ${inactiveConversations.length} inactive conversation(s) to unmatch`);

      // Process each inactive conversation
      let unmatched = 0;
      for (const conversation of inactiveConversations) {
        const didUnmatch = await this.autoUnmatch(conversation, io);
        if (didUnmatch) {
          unmatched++;
        }
      }

      if (unmatched > 0) {
        console.log(`✅ Auto-unmatched ${unmatched} conversation(s)`);
      }
    } catch (error) {
      console.error('Auto-unmatch checker error:', error);
    }
  }
}

export default new AutoUnmatchService();
