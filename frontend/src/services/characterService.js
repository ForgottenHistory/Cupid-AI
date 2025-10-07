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
   * Like a character
   */
  async likeCharacter(characterId) {
    return characterStorage.likeCharacter(characterId);
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
   * Update character card data in storage
   */
  async updateCharacterData(characterId, updates) {
    return characterStorage.updateCharacter(characterId, updates);
  }
}

export default new CharacterService();
