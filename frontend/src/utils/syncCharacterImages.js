import characterService from '../services/characterService';
import api from '../services/api';

/**
 * Sync all characters from IndexedDB to backend
 * This ensures all characters are available for post generation
 */
export async function syncAllCharacters(userId) {
  try {
    console.log('📤 Starting full character sync...');

    // Get all characters from IndexedDB
    const characters = await characterService.getAllCharacters(userId);

    if (!characters || characters.length === 0) {
      console.log('⚠️  No characters found in IndexedDB');
      return { success: true, synced: 0, skipped: 0, total: 0 };
    }

    // Extract all character data
    const characterData = characters.map(char => ({
      id: char.id,
      cardData: char.cardData,
      imageUrl: char.imageUrl || null
    }));

    console.log(`📋 Syncing ${characterData.length} characters to backend...`);

    // Send to backend
    const response = await api.post('/sync/characters', {
      characters: characterData
    });

    console.log(`✅ Character sync complete:`, response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Character sync failed:', error);
    throw error;
  }
}

/**
 * One-time sync of character images from IndexedDB to backend
 * Call this once to fix existing characters
 */
export async function syncCharacterImages(userId) {
  try {
    console.log('📤 Starting character image sync...');

    // Get all characters from IndexedDB
    const characters = await characterService.getAllCharacters(userId);

    if (!characters || characters.length === 0) {
      console.log('⚠️  No characters found in IndexedDB');
      return { success: true, updated: 0, skipped: 0, total: 0 };
    }

    // Extract character IDs and image URLs
    const characterData = characters.map(char => ({
      id: char.id,
      imageUrl: char.imageUrl || null
    })).filter(char => char.imageUrl); // Only send characters with images

    console.log(`📋 Found ${characterData.length} characters with images`);

    // Send to backend
    const response = await api.post('/sync/character-images', {
      characters: characterData
    });

    console.log(`✅ Sync complete:`, response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Character image sync failed:', error);
    throw error;
  }
}

/**
 * Debug function to clear all posts
 */
export async function clearAllPosts() {
  try {
    console.log('🗑️  Clearing all posts...');

    const response = await api.delete('/debug/clear-posts');

    console.log(`✅ Cleared ${response.data.deleted} posts`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to clear posts:', error);
    throw error;
  }
}

/**
 * Debug function to trigger proactive message for current character
 * Usage: triggerProactive('character-id')
 */
export async function triggerProactive(characterId) {
  try {
    if (!characterId) {
      // Try to get character ID from current URL
      const match = window.location.pathname.match(/\/chat\/([^/]+)/);
      if (match) {
        characterId = match[1];
      } else {
        console.error('❌ No character ID provided and not in a chat');
        return;
      }
    }

    console.log(`📬 Triggering proactive message for character ${characterId}...`);

    const response = await api.post(`/debug/trigger-proactive/${characterId}`);

    console.log(`✅ Proactive message check triggered`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to trigger proactive message:', error);
    throw error;
  }
}

// For debugging: call these from browser console
if (typeof window !== 'undefined') {
  window.syncAllCharacters = syncAllCharacters;
  window.syncCharacterImages = syncCharacterImages;
  window.clearAllPosts = clearAllPosts;
  window.triggerProactive = triggerProactive;
}
