import db from '../db/database.js';
import aiService from './aiService.js';
import messageService from './messageService.js';
import llmSettingsService from './llmSettingsService.js';
import memoryService from './memoryService.js';
import { loadPrompts } from '../routes/prompts.js';

class CompactService {
  /**
   * Generate a summary of a conversation block using Decision LLM
   * @param {Array} messages - Array of messages to summarize
   * @param {string} characterName - Name of the character
   * @param {string} userName - Name of the user
   * @param {number} userId - User ID for LLM settings
   * @returns {string} Summary text
   */
  async generateSummary(messages, characterName, userName, userId) {
    // Build conversation text from messages
    const conversationLines = messages.map(msg => {
      const name = msg.role === 'user' ? userName : characterName;
      return `${name}: ${msg.content}`;
    });

    const conversationText = conversationLines.join('\n');

    // Load custom prompt from config
    const prompts = loadPrompts();
    const template = prompts.compactionPrompt;

    // Replace placeholders
    const prompt = template
      .replace(/{characterName}/g, characterName)
      .replace(/{userName}/g, userName)
      .replace(/{conversationText}/g, conversationText);

    // Call Decision LLM directly (independent of Decision Engine)
    const userSettings = llmSettingsService.getUserSettings(userId);
    const decisionSettings = userSettings.decision || userSettings;

    const summaryResponse = await aiService.createBasicCompletion(prompt, {
      userId: userId,
      model: decisionSettings.model,
      temperature: decisionSettings.temperature || 0.7,
      max_tokens: 300, // Summaries should be short
      provider: decisionSettings.provider || 'openrouter',
      messageType: 'compaction',
      characterName: characterName,
      userName: userName
    });

    return summaryResponse.content.trim();
  }

  /**
   * Delete a small conversation block (< 15 messages)
   * Counts as a summary slot but doesn't create a summary message
   * @param {number} conversationId - Conversation ID
   * @param {number} startMessageId - First message ID in block
   * @param {number} endMessageId - Last message ID in block
   * @param {number} userId - User ID for memory extraction
   * @returns {Promise<boolean>} Success
   */
  async deleteBlock(conversationId, startMessageId, endMessageId, userId) {
    try {
      console.log(`🗑️  Deleting small block in conversation ${conversationId} (messages ${startMessageId}-${endMessageId})`);

      // Get messages for memory extraction BEFORE deleting
      const messages = db.prepare(`
        SELECT id, role, content, created_at, message_type
        FROM messages
        WHERE conversation_id = ? AND id BETWEEN ? AND ?
        ORDER BY created_at ASC
      `).all(conversationId, startMessageId, endMessageId);

      // Get character ID for memory extraction
      const conversation = db.prepare('SELECT character_id FROM conversations WHERE id = ?').get(conversationId);

      if (conversation && messages.length > 0) {
        // Extract memories BEFORE deleting the block
        try {
          await memoryService.extractMemories(conversation.character_id, messages, userId);
        } catch (memoryError) {
          console.error('⚠️  Memory extraction failed, continuing with deletion:', memoryError);
        }
      }

      // Check if we need to delete oldest summary first (enforce 5-slot cap)
      const summaryCount = messageService.countSummarySlots(conversationId);

      if (summaryCount >= 5) {
        const oldestSummary = messageService.getOldestSummary(conversationId);
        if (oldestSummary) {
          messageService.deleteMessage(oldestSummary.id);
          console.log(`🗑️  Deleted oldest summary (ID: ${oldestSummary.id}) to make room - enforcing 5-slot cap`);
        }
      }

      // Delete the messages in the block
      const deleteResult = db.prepare(`
        DELETE FROM messages
        WHERE conversation_id = ? AND id BETWEEN ? AND ?
      `).run(conversationId, startMessageId, endMessageId);

      console.log(`🗑️  Deleted ${deleteResult.changes} messages from small block (no summary created)`);

      return true;
    } catch (error) {
      console.error('❌ Failed to delete block:', error);
      return false;
    }
  }

  /**
   * Compact a conversation block by replacing messages with a summary
   * @param {number} conversationId - Conversation ID
   * @param {number} startMessageId - First message ID in block
   * @param {number} endMessageId - Last message ID in block
   * @param {number} userId - User ID for LLM settings
   * @returns {Promise<boolean>} Success
   */
  async compactBlock(conversationId, startMessageId, endMessageId, userId) {
    try {
      console.log(`🗜️  Compacting conversation ${conversationId} block (messages ${startMessageId}-${endMessageId})`);

      // Check if we need to delete oldest summary first (enforce 5-slot cap)
      const summaryCount = messageService.countSummarySlots(conversationId);

      if (summaryCount >= 5) {
        const oldestSummary = messageService.getOldestSummary(conversationId);
        if (oldestSummary) {
          messageService.deleteMessage(oldestSummary.id);
          console.log(`🗑️  Deleted oldest summary (ID: ${oldestSummary.id}) to make room - enforcing 5-slot cap`);
        }
      }

      // Get messages in the block
      const messages = db.prepare(`
        SELECT id, role, content, created_at, message_type
        FROM messages
        WHERE conversation_id = ? AND id BETWEEN ? AND ?
        ORDER BY created_at ASC
      `).all(conversationId, startMessageId, endMessageId);

      if (messages.length === 0) {
        console.warn('⚠️  No messages found in block, skipping');
        return false;
      }

      // Get character and user names for summary
      const conversation = db.prepare('SELECT user_id, character_id FROM conversations WHERE id = ?').get(conversationId);
      const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(conversation.user_id);
      const character = db.prepare('SELECT card_data FROM characters WHERE id = ? AND user_id = ?').get(conversation.character_id, conversation.user_id);

      const userName = user?.display_name || 'User';
      let characterName = 'Character';

      if (character) {
        try {
          const cardData = JSON.parse(character.card_data);
          characterName = cardData.data?.name || cardData.name || 'Character';
        } catch (e) {}
      }

      // Extract memories BEFORE deleting the block
      if (conversation) {
        try {
          await memoryService.extractMemories(conversation.character_id, messages, userId);
        } catch (memoryError) {
          console.error('⚠️  Memory extraction failed, continuing with compacting:', memoryError);
        }
      }

      // Generate summary
      console.log(`🤖 Generating summary for ${messages.length} messages...`);
      const summary = await this.generateSummary(messages, characterName, userName, userId);
      console.log(`✅ Summary generated: ${summary.substring(0, 100)}${summary.length > 100 ? '...' : ''}`);

      // Use the timestamp of the FIRST message in the block (preserves chronological order)
      const blockTimestamp = messages[0].created_at;

      // Delete the old messages in the block
      const deleteResult = db.prepare(`
        DELETE FROM messages
        WHERE conversation_id = ? AND id BETWEEN ? AND ?
      `).run(conversationId, startMessageId, endMessageId);

      console.log(`🗑️  Deleted ${deleteResult.changes} messages from block`);

      // Insert summary message
      const summaryContent = `[SUMMARY: ${summary}]`;
      db.prepare(`
        INSERT INTO messages (conversation_id, role, content, message_type, created_at)
        VALUES (?, 'system', ?, 'summary', ?)
      `).run(conversationId, summaryContent, blockTimestamp);

      console.log(`✅ Inserted summary message (slot ${summaryCount >= 5 ? 5 : summaryCount + 1}/5)`);

      return true;
    } catch (error) {
      console.error('❌ Failed to compact block:', error);
      return false;
    }
  }

  /**
   * Compact conversation if it exceeds token threshold
   * Keeps compacting until token count is below target
   * @param {number} conversationId - Conversation ID
   * @param {number} userId - User ID for settings and LLM
   * @param {object} io - Socket.io instance for emitting events (optional)
   * @param {string} characterId - Character ID for character-specific events (optional)
   * @returns {boolean} Whether any compacting was performed
   */
  async compactIfNeeded(conversationId, userId, io = null, characterId = null) {
    try {
      // Get user's compacting settings (percentages) and context window
      const userSettings = db.prepare(`
        SELECT
          compact_threshold_percent,
          compact_target_percent,
          keep_uncompacted_messages,
          llm_context_window
        FROM users WHERE id = ?
      `).get(userId);

      const thresholdPercent = userSettings?.compact_threshold_percent || 90;
      const targetPercent = userSettings?.compact_target_percent || 70;
      const contextWindow = userSettings?.llm_context_window || 32000;
      const keepUncompacted = userSettings?.keep_uncompacted_messages || 30;

      // Calculate actual token values from percentages
      const compactThreshold = Math.floor(contextWindow * (thresholdPercent / 100));
      const compactTarget = Math.floor(contextWindow * (targetPercent / 100));

      // Get conversation history and estimate token count
      const messages = messageService.getConversationHistory(conversationId);
      const tokenCount = aiService.estimateTokenCount(messages);

      console.log(`📊 Conversation ${conversationId} token count: ${tokenCount} (threshold: ${compactThreshold} = ${thresholdPercent}% of ${contextWindow})`);

      if (tokenCount < compactThreshold) {
        // No compacting needed
        return false;
      }

      console.log(`⚠️  Token count exceeds threshold, starting compacting...`);

      // Emit compacting_start event to lock the chat UI
      if (io && characterId) {
        io.to(`user:${userId}`).emit('compacting_start', { characterId });
      }

      let compactedAny = false;
      let attempts = 0;
      const maxAttempts = 10; // Prevent infinite loop

      // Keep compacting until we're under target or run out of blocks
      while (attempts < maxAttempts) {
        attempts++;

        // Find oldest processable block (could be delete or compact)
        const block = messageService.findOldestCompactableBlock(conversationId, keepUncompacted);

        if (!block) {
          console.log(`⚠️  No more processable blocks found`);
          break;
        }

        console.log(`🔍 Found block: ${block.messageCount} messages (IDs ${block.startMessageId}-${block.endMessageId}) - action: ${block.action.toUpperCase()}`);

        let success = false;

        if (block.action === 'delete') {
          // Delete small block (< 15 messages) without creating summary
          success = await this.deleteBlock(
            conversationId,
            block.startMessageId,
            block.endMessageId,
            userId
          );
        } else {
          // Compact large block (>= 15 messages) with summary
          success = await this.compactBlock(
            conversationId,
            block.startMessageId,
            block.endMessageId,
            userId
          );
        }

        if (!success) {
          console.error(`❌ Failed to ${block.action} block, stopping`);
          break;
        }

        compactedAny = true;

        // Re-check token count
        const updatedMessages = messageService.getConversationHistory(conversationId);
        const updatedTokenCount = aiService.estimateTokenCount(updatedMessages);

        console.log(`📊 Token count after ${block.action}: ${updatedTokenCount} (target: ${compactTarget})`);

        if (updatedTokenCount < compactTarget) {
          console.log(`✅ Reached target token count, stopping compacting`);
          break;
        }
      }

      if (compactedAny) {
        console.log(`✅ Compacting complete for conversation ${conversationId}`);
      }

      // Emit compacting_end event to unlock the chat UI
      if (io && characterId) {
        io.to(`user:${userId}`).emit('compacting_end', { characterId });
      }

      return compactedAny;
    } catch (error) {
      console.error('❌ compactIfNeeded error:', error);

      // Always emit compacting_end even on error to unlock UI
      if (io && characterId) {
        io.to(`user:${userId}`).emit('compacting_end', { characterId });
      }

      return false;
    }
  }
}

export default new CompactService();
