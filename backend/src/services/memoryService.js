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
 * - One-liner timeless facts with importance scores (0-100)
 * - Extracted using Content LLM from conversation blocks
 * - NEW memories are added and merged with existing ones
 * - Lowest importance memories are pruned when capacity reached
 * - Format: { importance: number, text: string }
 */
class MemoryService {
  /**
   * Get character memories from database
   * @param {string} characterId - Character ID
   * @returns {Array<{importance: number, text: string}>} Array of memory objects (max 50)
   */
  getCharacterMemories(characterId) {
    const character = db.prepare('SELECT memory_data FROM characters WHERE id = ?').get(characterId);

    if (!character || !character.memory_data) {
      return [];
    }

    try {
      const memories = JSON.parse(character.memory_data);

      // Handle old format (plain strings) - migrate to new format with importance 50
      if (Array.isArray(memories) && memories.length > 0) {
        if (typeof memories[0] === 'string') {
          console.log(`🔄 Migrating ${memories.length} old memories to new format with default importance 50`);
          return memories.map(text => ({ importance: 50, text }));
        }
        return memories;
      }

      return [];
    } catch (error) {
      console.error(`Failed to parse memory_data for character ${characterId}:`, error);
      return [];
    }
  }

  /**
   * Save character memories to database
   * @param {string} characterId - Character ID
   * @param {Array<{importance: number, text: string}>} memories - Array of memory objects (max 50)
   */
  saveCharacterMemories(characterId, memories) {
    if (!Array.isArray(memories)) {
      throw new Error('Memories must be an array');
    }

    // Sort by importance (highest first) and enforce 50 memory cap
    const sortedMemories = memories
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 50);

    const memoryData = JSON.stringify(sortedMemories);
    db.prepare('UPDATE characters SET memory_data = ? WHERE id = ?').run(memoryData, characterId);

    console.log(`💾 Saved ${sortedMemories.length} memories for character ${characterId} (importance range: ${sortedMemories[0]?.importance || 0}-${sortedMemories[sortedMemories.length - 1]?.importance || 0})`);
  }

  /**
   * Extract NEW memories from conversation block and merge with existing ones
   *
   * @param {string} characterId - Character ID
   * @param {Array} messages - Messages in the block to extract from
   * @param {number} userId - User ID (for LLM settings)
   * @returns {Promise<Array<{importance: number, text: string}>>} Updated array of memories (max 50)
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

    console.log(`🧠 Extracting NEW memories for ${characterName} from ${messages.length} messages...`);
    console.log(`📝 Current memories: ${existingMemories.length}/50`);

    // Get Content LLM settings
    const contentSettings = llmSettingsService.getUserSettings(userId);

    try {
      // Use Content LLM to extract NEW memories only
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

      // Parse NEW memories from response
      const newMemories = this._parseMemoriesFromResponse(response.content);

      if (newMemories.length === 0) {
        console.log(`ℹ️ No new memories extracted from this conversation`);
        return existingMemories;
      }

      console.log(`✅ Extracted ${newMemories.length} NEW memories for ${characterName}`);

      // Merge new memories with existing ones
      const mergedMemories = this._mergeMemories(existingMemories, newMemories);

      console.log(`💾 Total memories after merge: ${mergedMemories.length}/50`);

      // Save to database (saveCharacterMemories will sort and cap at 50)
      this.saveCharacterMemories(characterId, mergedMemories);

      return mergedMemories;
    } catch (error) {
      console.error('❌ Memory extraction failed:', error);
      // Return existing memories on failure
      return existingMemories;
    }
  }

  /**
   * Merge new memories with existing ones, keeping top 50 by importance
   * @param {Array<{importance: number, text: string}>} existingMemories - Current memories
   * @param {Array<{importance: number, text: string}>} newMemories - New memories to add
   * @returns {Array<{importance: number, text: string}>} Merged and sorted memories (max 50)
   * @private
   */
  _mergeMemories(existingMemories, newMemories) {
    // Combine all memories
    const allMemories = [...existingMemories, ...newMemories];

    // Sort by importance (highest first)
    allMemories.sort((a, b) => b.importance - a.importance);

    // Keep top 50
    const topMemories = allMemories.slice(0, 50);

    // Log what was pruned if any
    if (allMemories.length > 50) {
      const pruned = allMemories.length - 50;
      const lowestKept = topMemories[49].importance;
      console.log(`✂️ Pruned ${pruned} lowest importance memories (kept importance >= ${lowestKept})`);
    }

    return topMemories;
  }

  /**
   * Build memory extraction prompt
   * @param {string} characterName - Character name
   * @param {string} conversationHistory - Formatted conversation
   * @param {Array<{importance: number, text: string}>} existingMemories - Current memories
   * @returns {string} Memory extraction prompt
   * @private
   */
  _buildMemoryExtractionPrompt(characterName, conversationHistory, existingMemories) {
    // Load custom prompts from config
    const prompts = loadPrompts();
    const template = prompts.memoryExtractionPrompt;

    // Format existing memories section with importance scores
    const existingMemoriesFormatted = existingMemories.length > 0
      ? existingMemories.map(m => `${m.importance}: ${m.text}`).join('\n')
      : 'None yet.';

    // Replace placeholders in template
    return template
      .replace(/{characterName}/g, characterName)
      .replace(/{conversationHistory}/g, conversationHistory)
      .replace(/{existingCount}/g, existingMemories.length.toString())
      .replace(/{existingMemories}/g, existingMemoriesFormatted);
  }

  /**
   * Parse memories from LLM response with importance scores
   * @param {string} response - LLM response text
   * @returns {Array<{importance: number, text: string}>} Parsed memories with importance
   * @private
   */
  _parseMemoriesFromResponse(response) {
    const lines = response.trim().split('\n');
    const memories = [];

    // Check for NO_NEW_MEMORIES response
    if (response.trim() === 'NO_NEW_MEMORIES') {
      return [];
    }

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine === 'NO_NEW_MEMORIES') {
        continue;
      }

      // Match format: "importance_score: memory text"
      // Example: "85: User is vegetarian"
      const match = trimmedLine.match(/^(\d+):\s*(.+)$/);
      if (match) {
        const importance = parseInt(match[1], 10);
        const text = match[2].trim();

        // Validate importance score (0-100)
        if (importance >= 0 && importance <= 100 && text.length > 0) {
          memories.push({ importance, text });
        } else {
          console.warn(`⚠️ Invalid memory format: "${trimmedLine}" (importance must be 0-100)`);
        }
      } else {
        console.warn(`⚠️ Skipping line with invalid format: "${trimmedLine}"`);
      }
    }

    return memories;
  }
}

export default new MemoryService();
