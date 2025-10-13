import db from '../db/database.js';
import aiService from './aiService.js';
import messageService from './messageService.js';
import llmSettingsService from './llmSettingsService.js';

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

    // Build summary prompt
    const prompt = `You are reviewing a past conversation between ${userName} and ${characterName} in a dating simulation.

Your task: Create a concise summary (2-4 sentences) that preserves:
- Key facts shared (names, events, plans, promises)
- Emotional moments and relationship dynamics
- Important decisions or agreements
- The overall narrative flow

Do not:
- Use phrases like "in this conversation" or "they discussed" (state facts directly as if recalling)
- Include timestamps or meta-commentary
- Lose critical personal information

Conversation to summarize:
${conversationText}

Output format:
A natural, flowing summary as if the character is recalling what happened.

Example:
"We talked about their stressful week at work. They opened up about feeling overwhelmed with deadlines and worried about letting their team down. I reassured them that asking for help is a strength, not a weakness. We made plans to do something relaxing this weekend to decompress."`;

    try {
      // Use Decision LLM for summary generation
      const response = await aiService.makeDecision({
        messages: [], // Not used for this type of decision
        characterData: null,
        userId: userId,
        decisionType: 'summary',
        customPrompt: prompt
      });

      // makeDecision returns an object, but for summary we just need the raw text
      // Fall back to calling Decision LLM directly
      const userSettings = llmSettingsService.getUserSettings(userId);
      const decisionSettings = userSettings.decision || userSettings;

      const summaryResponse = await aiService.createBasicCompletion(prompt, {
        userId: userId,
        model: decisionSettings.model,
        temperature: decisionSettings.temperature || 0.7,
        max_tokens: 300, // Summaries should be short
        provider: decisionSettings.provider || 'openrouter'
      });

      return summaryResponse.content.trim();
    } catch (error) {
      console.error('Failed to generate summary:', error);
      // Fallback: Generic summary
      return 'Previous conversation continued.';
    }
  }

  /**
   * Compact a conversation block by replacing messages with a summary
   * @param {number} conversationId - Conversation ID
   * @param {number} startMessageId - First message ID in block
   * @param {number} endMessageId - Last message ID in block
   * @param {number} userId - User ID for LLM settings
   * @returns {boolean} Success
   */
  async compactBlock(conversationId, startMessageId, endMessageId, userId) {
    try {
      console.log(`🗜️  Compacting conversation ${conversationId} block (messages ${startMessageId}-${endMessageId})`);

      // Get messages in the block
      const messages = db.prepare(`
        SELECT id, role, content, created_at
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

      console.log(`✅ Inserted summary message`);

      // Enforce 5-summary limit: Keep only 5 most recent summaries
      const summaries = db.prepare(`
        SELECT id FROM messages
        WHERE conversation_id = ? AND message_type = 'summary'
        ORDER BY created_at DESC
      `).all(conversationId);

      if (summaries.length > 5) {
        const toDelete = summaries.slice(5); // Get all after the 5th
        toDelete.forEach(s => {
          db.prepare('DELETE FROM messages WHERE id = ?').run(s.id);
          console.log(`🗑️  Deleted old summary (ID: ${s.id}) - keeping only 5 most recent`);
        });
      }

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
   * @returns {boolean} Whether any compacting was performed
   */
  async compactIfNeeded(conversationId, userId) {
    try {
      // Get user's compacting settings
      const userSettings = db.prepare(`
        SELECT compact_threshold, compact_target, keep_uncompacted_messages
        FROM users WHERE id = ?
      `).get(userId);

      const compactThreshold = userSettings?.compact_threshold || 26000;
      const compactTarget = userSettings?.compact_target || 20000;
      const keepUncompacted = userSettings?.keep_uncompacted_messages || 30;

      // Get conversation history and estimate token count
      const messages = messageService.getConversationHistory(conversationId);
      const tokenCount = aiService.estimateTokenCount(messages);

      console.log(`📊 Conversation ${conversationId} token count: ${tokenCount} (threshold: ${compactThreshold})`);

      if (tokenCount < compactThreshold) {
        // No compacting needed
        return false;
      }

      console.log(`⚠️  Token count exceeds threshold, starting compacting...`);

      let compactedAny = false;
      let attempts = 0;
      const maxAttempts = 10; // Prevent infinite loop

      // Keep compacting until we're under target or run out of blocks
      while (attempts < maxAttempts) {
        attempts++;

        // Find oldest compactable block
        const block = messageService.findOldestCompactableBlock(conversationId, keepUncompacted);

        if (!block) {
          console.log(`⚠️  No more compactable blocks found`);
          break;
        }

        console.log(`🔍 Found compactable block: ${block.messageCount} messages (IDs ${block.startMessageId}-${block.endMessageId})`);

        // Compact the block
        const success = await this.compactBlock(
          conversationId,
          block.startMessageId,
          block.endMessageId,
          userId
        );

        if (!success) {
          console.error(`❌ Failed to compact block, stopping`);
          break;
        }

        compactedAny = true;

        // Re-check token count
        const updatedMessages = messageService.getConversationHistory(conversationId);
        const updatedTokenCount = aiService.estimateTokenCount(updatedMessages);

        console.log(`📊 Token count after compacting: ${updatedTokenCount} (target: ${compactTarget})`);

        if (updatedTokenCount < compactTarget) {
          console.log(`✅ Reached target token count, stopping compacting`);
          break;
        }
      }

      if (compactedAny) {
        console.log(`✅ Compacting complete for conversation ${conversationId}`);
      }

      return compactedAny;
    } catch (error) {
      console.error('❌ compactIfNeeded error:', error);
      return false;
    }
  }
}

export default new CompactService();
