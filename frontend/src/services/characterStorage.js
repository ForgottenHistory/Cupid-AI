import { getDB, STORES } from './db';
import { v4 as uuidv4 } from 'uuid';

class CharacterStorage {
  /**
   * Add a new character to storage
   */
  async addCharacter({ cardData, imageBlob, userId }) {
    const db = await getDB();

    // Convert image blob to base64 for storage
    const imageUrl = await this.blobToBase64(imageBlob);

    // Store original description if not already stored
    if (cardData.data.description && !cardData.data.originalDescription) {
      cardData.data.originalDescription = cardData.data.description;
    }

    const character = {
      id: uuidv4(),
      userId,
      name: cardData.data.name,
      cardData,
      imageUrl,
      isLiked: false,
      likedAt: null,
      uploadedAt: Date.now(),
      tags: cardData.data.tags || [],
    };

    await db.add(STORES.CHARACTERS, character);
    return character;
  }

  /**
   * Get all characters for a user
   */
  async getCharacters(userId) {
    const db = await getDB();
    const tx = db.transaction(STORES.CHARACTERS, 'readonly');
    const store = tx.objectStore(STORES.CHARACTERS);
    const index = store.index('userId');

    const characters = await index.getAll(userId);
    await tx.done;

    return characters;
  }

  /**
   * Get a single character by ID
   */
  async getCharacter(characterId) {
    const db = await getDB();
    return db.get(STORES.CHARACTERS, characterId);
  }

  /**
   * Get all liked characters for a user
   */
  async getLikedCharacters(userId) {
    const db = await getDB();
    const allCharacters = await this.getCharacters(userId);
    return allCharacters.filter(char => char.isLiked);
  }

  /**
   * Update a character
   */
  async updateCharacter(characterId, updates) {
    const db = await getDB();
    const character = await db.get(STORES.CHARACTERS, characterId);

    if (!character) {
      throw new Error('Character not found');
    }

    const updatedCharacter = {
      ...character,
      ...updates,
    };

    await db.put(STORES.CHARACTERS, updatedCharacter);
    return updatedCharacter;
  }

  /**
   * Like a character
   */
  async likeCharacter(characterId) {
    return this.updateCharacter(characterId, {
      isLiked: true,
      likedAt: Date.now(),
    });
  }

  /**
   * Unlike a character
   */
  async unlikeCharacter(characterId) {
    return this.updateCharacter(characterId, {
      isLiked: false,
      likedAt: null,
    });
  }

  /**
   * Delete a character
   */
  async deleteCharacter(characterId) {
    const db = await getDB();
    await db.delete(STORES.CHARACTERS, characterId);

    // Also delete from backend
    try {
      const api = (await import('./api')).default;
      await api.delete(`/characters/${characterId}`);
    } catch (error) {
      console.error('Failed to delete character from backend:', error);
      // Don't throw - IndexedDB deletion already succeeded
    }
  }

  /**
   * Delete all characters for a user
   */
  async deleteAllCharacters(userId) {
    const db = await getDB();
    const characters = await this.getCharacters(userId);

    const tx = db.transaction(STORES.CHARACTERS, 'readwrite');
    await Promise.all(
      characters.map(char => tx.store.delete(char.id))
    );
    await tx.done;
  }

  /**
   * Get characters that haven't been liked or passed yet
   */
  async getUnswipedCharacters(userId) {
    const db = await getDB();
    const allCharacters = await this.getCharacters(userId);

    // For now, return characters that aren't liked
    // In the future, we can track "passed" separately
    return allCharacters.filter(char => !char.isLiked);
  }

  /**
   * Check if a character exists by name (to prevent duplicates)
   */
  async characterExists(userId, characterName) {
    const db = await getDB();
    const characters = await this.getCharacters(userId);
    return characters.some(char => char.name === characterName);
  }

  /**
   * Get character count for user
   */
  async getCharacterCount(userId) {
    const characters = await this.getCharacters(userId);
    return characters.length;
  }

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
   * Convert base64 string to Blob
   */
  base64ToBlob(base64) {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }

    return new Blob([uInt8Array], { type: contentType });
  }

  /**
   * Clear all data from the database (for account deletion)
   */
  async clearAllData() {
    const db = await this.initDB();
    const tx = db.transaction('characters', 'readwrite');
    const store = tx.objectStore('characters');
    store.clear();
    return tx.complete;
  }
}

export default new CharacterStorage();
