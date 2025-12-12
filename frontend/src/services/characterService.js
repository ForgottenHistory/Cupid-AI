import { v4 as uuidv4 } from 'uuid';
import { characterImageParser } from '../utils/characterImageParser';
import api from './api';

/**
 * Character Service - Backend-only storage
 * All character data is stored in backend SQLite, no IndexedDB
 */
class CharacterService {
  /**
   * Convert Blob to base64 string
   */
  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

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

      // Convert image to base64
      const imageUrl = await this.blobToBase64(file);

      // Generate UUID for the character
      const id = uuidv4();

      // Create character in backend
      const response = await api.post('/characters', {
        id,
        cardData,
        imageUrl,
        isLiked: false
      });

      return response.data.character;
    } catch (error) {
      // Handle duplicate name error
      if (error.response?.status === 409) {
        throw new Error(`Character "${error.response.data.error || 'already exists'}"`);
      }
      console.error('Failed to import character:', error);
      throw error;
    }
  }

  /**
   * Create character directly with cardData and image blob (for wizard-generated characters)
   */
  async createCharacter({ cardData, imageBlob, userId }) {
    try {
      // Convert image to base64
      const imageUrl = await this.blobToBase64(imageBlob);

      // Generate UUID for the character
      const id = uuidv4();

      // Create character in backend
      const response = await api.post('/characters', {
        id,
        cardData,
        imageUrl,
        isLiked: false
      });

      return response.data.character;
    } catch (error) {
      if (error.response?.status === 409) {
        throw new Error(`Character "${cardData.data?.name || 'Unknown'}" already exists`);
      }
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
   * @param {number} userId - User ID (not used, auth token determines user)
   * @param {string} filter - 'all', 'liked', or 'swipeable'
   * @param {string} search - Optional search query
   */
  async getAllCharacters(userId, filter = 'all', search = null) {
    const params = { filter };
    if (search) params.search = search;

    const response = await api.get('/characters', { params });
    return response.data.characters;
  }

  /**
   * Get character by ID
   */
  async getCharacter(characterId) {
    const response = await api.get(`/characters/${characterId}`);

    // Parse card_data if it's a string
    const char = response.data;
    if (typeof char.card_data === 'string') {
      char.cardData = JSON.parse(char.card_data);
    } else {
      char.cardData = char.card_data || char.cardData;
    }

    // Normalize field names
    return {
      id: char.id,
      name: char.name,
      cardData: char.cardData,
      imageUrl: char.image_url || char.imageUrl,
      thumbnailUrl: char.thumbnail_url || char.thumbnailUrl,
      isLiked: !!char.is_liked || !!char.isLiked,
      likedAt: char.liked_at || char.likedAt,
      uploadedAt: char.created_at || char.uploadedAt,
      tags: char.cardData?.data?.tags || [],
      scheduleData: char.schedule_data ? JSON.parse(char.schedule_data) : char.scheduleData,
      personalityData: char.personality_data ? JSON.parse(char.personality_data) : char.personalityData,
      imageTags: char.image_tags || char.imageTags,
      contextualTags: char.contextual_tags || char.contextualTags,
      voiceId: char.voice_id || char.voiceId,
      postInstructions: char.post_instructions || char.postInstructions,
      memoryData: char.memory_data ? JSON.parse(char.memory_data) : char.memoryData
    };
  }

  /**
   * Get liked characters
   */
  async getLikedCharacters(userId) {
    return this.getAllCharacters(userId, 'liked');
  }

  /**
   * Get characters available for swiping
   */
  async getSwipeableCharacters(userId) {
    return this.getAllCharacters(userId, 'swipeable');
  }

  /**
   * Like a character (mark as match)
   */
  async likeCharacter(characterId) {
    try {
      const response = await api.post(`/characters/${characterId}/like`);

      // Get the updated character
      const character = await this.getCharacter(characterId);

      return {
        character,
        isSuperLike: response.data.isSuperLike || false
      };
    } catch (error) {
      if (error.response?.status === 400) {
        throw new Error(error.response.data.error || 'Failed to match character');
      }
      console.error('Failed to like character:', error);
      throw error;
    }
  }

  /**
   * Unlike a character
   */
  async unlikeCharacter(characterId) {
    const response = await api.put(`/characters/${characterId}`, {
      isLiked: false,
      likedAt: null
    });
    return response.data.character;
  }

  /**
   * Delete a character
   */
  async deleteCharacter(characterId) {
    await api.delete(`/characters/${characterId}`);
  }

  /**
   * Get character statistics
   */
  async getStats(userId) {
    const response = await api.get('/characters/stats');
    return {
      total: response.data.total,
      liked: response.data.liked,
      remaining: response.data.swipeable,
    };
  }

  /**
   * Search characters by name
   */
  async searchCharacters(userId, query) {
    return this.getAllCharacters(userId, 'all', query);
  }

  /**
   * Get characters by tag (client-side filter on fetched data)
   */
  async getCharactersByTag(userId, tag) {
    const characters = await this.getAllCharacters(userId);
    return characters.filter(char =>
      char.tags?.some(t => t.toLowerCase() === tag.toLowerCase())
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
   * Update character card data
   */
  async updateCharacterData(characterId, updates) {
    const response = await api.put(`/characters/${characterId}`, updates);
    return response.data.character;
  }
}

export default new CharacterService();
