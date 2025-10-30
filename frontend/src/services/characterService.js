import { characterImageParser } from '../utils/characterImageParser';
import characterStorage from './characterStorage';
import api from './api';

class CharacterService {
  /**
   * Import character from PNG file
   */
  async importCharacterFromPNG(file, userId) {
    try {
      // Validate file type
      if (!file.type.startsWith('image/png')) {
        throw new Error('File must be a PNG image');
      }

      // Parse character data from PNG
      const cardData = await characterImageParser.extractFromPNG(file);

      if (!cardData) {
        throw new Error('No character data found in PNG. Make sure this is a valid Character Card v2 file.');
      }

      // Check if character already exists
      const exists = await characterStorage.characterExists(userId, cardData.data.name);
      if (exists) {
        throw new Error(`Character "${cardData.data.name}" already exists`);
      }

      // Store character with image
      const character = await characterStorage.addCharacter({
        cardData,
        imageBlob: file,
        userId,
      });

      return character;
    } catch (error) {
      console.error('Failed to import character:', error);
      throw error;
    }
  }

  /**
   * Create character directly with cardData and image blob (for wizard-generated characters)
   */
  async createCharacter({ cardData, imageBlob, userId }) {
    try {
      // Check if character already exists
      const exists = await characterStorage.characterExists(userId, cardData.data.name);
      if (exists) {
        throw new Error(`Character "${cardData.data.name}" already exists`);
      }

      // Store character with image
      const character = await characterStorage.addCharacter({
        cardData,
        imageBlob,
        userId,
      });

      return character;
    } catch (error) {
      console.error('Failed to create character:', error);
      throw error;
    }
  }

  /**
   * Import multiple characters from PNG files
   */
  async importMultipleCharacters(files, userId) {
    const results = {
      success: [],
      failed: [],
    };

    for (const file of files) {
      try {
        const character = await this.importCharacterFromPNG(file, userId);
        results.success.push(character);
      } catch (error) {
        results.failed.push({
          filename: file.name,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get all characters for user
   */
  async getAllCharacters(userId) {
    return characterStorage.getCharacters(userId);
  }

  /**
   * Get character by ID
   */
  async getCharacter(characterId) {
    return characterStorage.getCharacter(characterId);
  }

  /**
   * Get liked characters
   */
  async getLikedCharacters(userId) {
    return characterStorage.getLikedCharacters(userId);
  }

  /**
   * Get characters available for swiping
   */
  async getSwipeableCharacters(userId) {
    return characterStorage.getUnswipedCharacters(userId);
  }

  /**
   * Like a character (mark as match) and check for super like
   */
  async likeCharacter(characterId) {
    // Update local storage first
    const character = await characterStorage.likeCharacter(characterId);

    // Call backend to check for super like
    try {
      const response = await api.post(`/characters/${characterId}/like`, {
        characterData: character.cardData.data
      });

      return {
        character,
        isSuperLike: response.data.isSuperLike || false
      };
    } catch (error) {
      console.error('Failed to check super like:', error);
      // Return character anyway, just without super like info
      return {
        character,
        isSuperLike: false
      };
    }
  }

  /**
   * Unlike a character
   */
  async unlikeCharacter(characterId) {
    return characterStorage.unlikeCharacter(characterId);
  }

  /**
   * Delete a character
   */
  async deleteCharacter(characterId) {
    return characterStorage.deleteCharacter(characterId);
  }

  /**
   * Get character statistics
   */
  async getStats(userId) {
    const allCharacters = await characterStorage.getCharacters(userId);
    const likedCharacters = allCharacters.filter(c => c.isLiked);

    return {
      total: allCharacters.length,
      liked: likedCharacters.length,
      remaining: allCharacters.length - likedCharacters.length,
    };
  }

  /**
   * Search characters by name
   */
  async searchCharacters(userId, query) {
    const characters = await characterStorage.getCharacters(userId);
    const lowerQuery = query.toLowerCase();

    return characters.filter(char =>
      char.name.toLowerCase().includes(lowerQuery) ||
      char.cardData.data.description?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get characters by tag
   */
  async getCharactersByTag(userId, tag) {
    const characters = await characterStorage.getCharacters(userId);
    return characters.filter(char =>
      char.tags.some(t => t.toLowerCase() === tag.toLowerCase())
    );
  }

  /**
   * Cleanup description using AI
   */
  async cleanupDescription(description) {
    const response = await api.post('/characters/cleanup-description', { description });
    return response.data.cleanedDescription;
  }

  /**
   * Generate dating profile from description using AI
   */
  async generateDatingProfile(description, name) {
    const response = await api.post('/characters/generate-dating-profile', { description, name });
    return response.data.profile;
  }

  /**
   * Generate weekly schedule from description using AI
   * @param {string} description - Character description
   * @param {string} name - Character name
   * @param {string} day - Optional specific day (MONDAY, TUESDAY, etc)
   * @param {string} extraInstructions - Optional extra user instructions
   */
  async generateSchedule(description, name, day = null, extraInstructions = null) {
    const url = day
      ? `/characters/generate-schedule?day=${day.toUpperCase()}`
      : '/characters/generate-schedule';
    const response = await api.post(url, { description, name, extraInstructions });
    return response.data.schedule;
  }

  /**
   * Generate Big Five personality traits from description using AI
   */
  async generatePersonality(description, name, personality) {
    const response = await api.post('/characters/generate-personality', { description, name, personality });
    return response.data.personality;
  }

  /**
   * Get character's current status based on their schedule
   */
  async getCharacterStatus(characterId, schedule) {
    const response = await api.post(`/characters/${characterId}/status`, { schedule });
    return response.data;
  }

  /**
   * Get character's engagement state
   */
  async getCharacterEngagement(characterId) {
    const response = await api.get(`/characters/${characterId}/engagement`);
    return response.data;
  }

  /**
   * Update character card data in storage
   */
  async updateCharacterData(characterId, updates) {
    return characterStorage.updateCharacter(characterId, updates);
  }

  /**
   * Sync IndexedDB with backend - removes characters that are no longer matched in backend
   * This is useful for cleaning up orphaned characters from failed auto-unmatch events
   * @param {number} userId - User ID
   * @returns {Promise<{removed: number, removedCharacters: Array}>} Number of characters removed and their details
   */
  async syncWithBackend(userId) {
    try {
      console.log('🔄 Starting manual sync with backend...');

      // Get all liked characters from IndexedDB
      const localCharacters = await characterStorage.getCharacters(userId);
      const likedCharacters = localCharacters.filter(c => c.isLiked);

      console.log(`📊 Found ${likedCharacters.length} liked characters in IndexedDB`);

      // Get all matched characters from backend
      const response = await api.get('/sync/matched-characters');
      const backendCharacterIds = new Set(response.data.characterIds);

      console.log(`📊 Found ${backendCharacterIds.size} matched characters in backend`);

      // Find characters in IndexedDB that are NOT in backend (orphaned)
      const orphanedCharacters = likedCharacters.filter(
        char => !backendCharacterIds.has(char.id)
      );

      console.log(`💔 Found ${orphanedCharacters.length} orphaned characters to remove`);

      // Remove orphaned characters from IndexedDB
      const removed = [];
      for (const character of orphanedCharacters) {
        console.log(`🗑️ Removing orphaned character: ${character.name} (${character.id})`);
        await characterStorage.unlikeCharacter(character.id);
        removed.push({
          id: character.id,
          name: character.name
        });
      }

      // Notify other components to refresh
      if (removed.length > 0) {
        window.dispatchEvent(new Event('characterUpdated'));
      }

      console.log(`✅ Sync complete: ${removed.length} characters removed`);

      return {
        removed: removed.length,
        removedCharacters: removed
      };
    } catch (error) {
      console.error('❌ Failed to sync with backend:', error);
      throw error;
    }
  }
}

export default new CharacterService();
