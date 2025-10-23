import db from '../db/database.js';
import aiService from './aiService.js';
import llmSettingsService from './llmSettingsService.js';
import { loadPrompts } from '../routes/prompts.js';

/**
 * Memory Service - Extracts and manages long-term memories for characters
 *
 * Memories are:
 * - Stored per character (shared across all users)
 * - Max 50 memories per character
 * - One-liner timeless facts
 * - Extracted using Decision LLM before compacting
 * - Rewritten/consolidated every time
 */
class MemoryService {
  /**
   * Get character memories from database
   * @param {string} characterId - Character ID
   * @returns {Array<string>} Array of memory strings (max 50)
   */
  getCharacterMemories(characterId) {
    const character = db.prepare('SELECT memory_data FROM characters WHERE id = ?').get(characterId);

    if (!character || !character.memory_data) {
      return [];
    }

    try {
      const memories = JSON.parse(character.memory_data);
      return Array.isArray(memories) ? memories : [];
    } catch (error) {
      console.error(`Failed to parse memory_data for character ${characterId}:`, error);
      return [];
    }
  }

  /**
   * Save character memories to database
   * @param {string} characterId - Character ID
   * @param {Array<string>} memories - Array of memory strings (max 50)
   */
  saveCharacterMemories(characterId, memories) {
    if (!Array.isArray(memories)) {
      throw new Error('Memories must be an array');
    }

    // Enforce 50 memory cap
    const cappedMemories = memories.slice(0, 50);

    const memoryData = JSON.stringify(cappedMemories);
    db.prepare('UPDATE characters SET memory_data = ? WHERE id = ?').run(memoryData, characterId);

    console.log(`💾 Saved ${cappedMemories.length} memories for character ${characterId}`);
  }

  /**
   * Extract memories from conversation block using Decision LLM
   * Analyzes the block and consolidates with existing memories
   *
   * @param {string} characterId - Character ID
   * @param {Array} messages - Messages in the block to extract from
   * @param {number} userId - User ID (for LLM settings)
   * @returns {Promise<Array<string>>} Updated array of memories (max 50)
   */
  async extractMemories(characterId, messages, userId) {
    // Get character data
    const character = db.prepare('SELECT card_data, name FROM characters WHERE id = ?').get(characterId);
    if (!character) {
      throw new Error(`Character ${characterId} not found`);
    }

    let characterData;
    try {
      characterData = JSON.parse(character.card_data);
    } catch (error) {
      console.error('Failed to parse character card_data:', error);
      throw new Error('Invalid character data');
    }

    const characterName = characterData.data?.name || characterData.name || character.name || 'Character';

    // Get existing memories
    const existingMemories = this.getCharacterMemories(characterId);

    // Format conversation block
    const conversationHistory = messages.map(m => {
      if (m.role === 'system') {
        return m.content;
      }
      return `${m.role === 'user' ? 'User' : characterName}: ${m.content}`;
    }).join('\n');

    // Build memory extraction prompt
    const memoryPrompt = this._buildMemoryExtractionPrompt(
      characterName,
      conversationHistory,
      existingMemories
    );

    console.log(`🧠 Extracting memories for ${characterName} from ${messages.length} messages...`);
    console.log(`📝 Current memories: ${existingMemories.length}/50`);

    // Get Content LLM settings (testing Content LLM instead of Decision LLM)
    const contentSettings = llmSettingsService.getUserSettings(userId);

    try {
      // Use Content LLM to extract and consolidate memories
      const response = await aiService.createBasicCompletion(memoryPrompt, {
        userId: userId,
        provider: contentSettings.provider,
        model: contentSettings.model,
        temperature: contentSettings.temperature,
        max_tokens: contentSettings.max_tokens,
        top_p: contentSettings.top_p,
        frequency_penalty: contentSettings.frequency_penalty,
        presence_penalty: contentSettings.presence_penalty,
        top_k: contentSettings.top_k,
        repetition_penalty: contentSettings.repetition_penalty,
        min_p: contentSettings.min_p,
        messageType: 'memory-extraction',
        characterName: characterName,
        userName: 'System',
      });

      // Parse memories from response
      const newMemories = this._parseMemoriesFromResponse(response);

      console.log(`✅ Extracted ${newMemories.length} memories for ${characterName}`);

      // Save to database
      this.saveCharacterMemories(characterId, newMemories);

      return newMemories;
    } catch (error) {
      console.error('❌ Memory extraction failed:', error);
      // Return existing memories on failure
      return existingMemories;
    }
  }

  /**
   * Build memory extraction prompt for Decision LLM
   * @param {string} characterName - Character name
   * @param {string} conversationHistory - Formatted conversation
   * @param {Array<string>} existingMemories - Current memories
   * @returns {string} Memory extraction prompt
   * @private
   */
  _buildMemoryExtractionPrompt(characterName, conversationHistory, existingMemories) {
    // Load custom prompts from config
    const prompts = loadPrompts();
    const template = prompts.memoryExtractionPrompt;

    // Format existing memories section
    const existingMemoriesFormatted = existingMemories.length > 0
      ? existingMemories.map((m, i) => `${i + 1}. ${m}`).join('\n')
      : 'None yet.';

    // Replace placeholders in template
    return template
      .replace(/{characterName}/g, characterName)
      .replace(/{conversationHistory}/g, conversationHistory)
      .replace(/{existingCount}/g, existingMemories.length.toString())
      .replace(/{existingMemories}/g, existingMemoriesFormatted);
  }

  /**
   * Parse memories from LLM response
   * @param {string} response - LLM response text
   * @returns {Array<string>} Parsed memories
   * @private
   */
  _parseMemoriesFromResponse(response) {
    const lines = response.trim().split('\n');
    const memories = [];

    for (const line of lines) {
      // Match numbered lines: "1. memory" or "1) memory"
      const match = line.match(/^\s*\d+[\.)]\s*(.+)$/);
      if (match) {
        const memory = match[1].trim();
        if (memory && memory.length > 0) {
          memories.push(memory);
        }
      }
    }

    // Cap at 50 memories
    return memories.slice(0, 50);
  }
}

export default new MemoryService();
