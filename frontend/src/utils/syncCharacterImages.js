import characterService from '../services/characterService';
import api from '../services/api';

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

// For debugging: call this from browser console
if (typeof window !== 'undefined') {
  window.syncCharacterImages = syncCharacterImages;
}
