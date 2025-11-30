import express from 'express';
import sharp from 'sharp';
import { authenticateToken } from '../middleware/auth.js';
import db from '../db/database.js';

/**
 * Generate a thumbnail from a base64 image data URL
 * @param {string} imageUrl - Base64 data URL (data:image/png;base64,...)
 * @returns {Promise<string|null>} - Thumbnail as base64 data URL or null if failed
 */
async function generateThumbnail(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('data:')) {
    return null;
  }

  try {
    // Extract base64 data from data URL
    const base64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!base64Match) {
      return null;
    }

    const imageBuffer = Buffer.from(base64Match[1], 'base64');

    // Generate 128x170 thumbnail (same as AI-Chat-Template)
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(128, 170, { fit: 'cover' })
      .png({ quality: 80 })
      .toBuffer();

    return `data:image/png;base64,${thumbnailBuffer.toString('base64')}`;
  } catch (error) {
    console.warn('Failed to generate thumbnail:', error.message);
    return null;
  }
}

const router = express.Router();

/**
 * POST /api/sync/characters
 * Sync all characters from frontend IndexedDB to backend
 * This ensures all characters are available for post generation
 * Body: { characters: [{ id, cardData, imageUrl }] }
 */
router.post('/characters', authenticateToken, (req, res) => {
  try {
    const { characters } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(characters)) {
      return res.status(400).json({ error: 'Characters must be an array' });
    }

    let synced = 0;
    let skipped = 0;
    let deleted = 0;

    // Get list of character IDs from IndexedDB
    const indexedDBCharacterIds = characters.map(c => c.id).filter(Boolean);

    // Sync characters from IndexedDB to backend
    for (const char of characters) {
      if (!char.id || !char.cardData) {
        skipped++;
        continue;
      }

      try {
        // Extract data from card data
        const name = char.cardData?.data?.name || 'Character';
        const imageTags = char.cardData?.data?.imageTags || null;
        const contextualTags = char.cardData?.data?.contextualTags || null;
        const schedule = char.cardData?.data?.schedule || null;
        const personalityTraits = char.cardData?.data?.personalityTraits || null;

        // Check if character already exists
        const existing = db.prepare('SELECT id, schedule_generated_at FROM characters WHERE id = ? AND user_id = ?').get(char.id, userId);

        if (existing) {
          // Update existing character - sync schedule, personality, and tags from IndexedDB
          // Only update schedule_generated_at if we're syncing a new schedule
          db.prepare(`
            UPDATE characters
            SET name = ?,
                card_data = ?,
                image_tags = ?,
                contextual_tags = ?,
                schedule_data = ?,
                personality_data = ?,
                schedule_generated_at = ?
            WHERE id = ? AND user_id = ?
          `).run(
            name,
            JSON.stringify(char.cardData),
            imageTags || null,
            contextualTags || null,
            schedule ? JSON.stringify(schedule) : null,
            personalityTraits ? JSON.stringify(personalityTraits) : null,
            schedule ? new Date().toISOString() : existing.schedule_generated_at,
            char.id,
            userId
          );
        } else {
          // Insert new character
          db.prepare(`
            INSERT INTO characters
            (id, user_id, name, card_data, image_url, image_tags, contextual_tags, schedule_data, personality_data, schedule_generated_at, created_at)
            VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(
            char.id,
            userId,
            name,
            JSON.stringify(char.cardData),
            imageTags || null,
            contextualTags || null,
            schedule ? JSON.stringify(schedule) : null,
            personalityTraits ? JSON.stringify(personalityTraits) : null,
            schedule ? new Date().toISOString() : null
          );
        }

        synced++;
      } catch (error) {
        console.error(`Failed to sync character ${char.id}:`, error);
        skipped++;
      }
    }

    // Clean up: delete backend characters that don't exist in IndexedDB
    // This removes characters the user deleted from frontend
    const backendCharacters = db.prepare('SELECT id FROM characters WHERE user_id = ?').all(userId);
    for (const backendChar of backendCharacters) {
      if (!indexedDBCharacterIds.includes(backendChar.id)) {
        db.prepare('DELETE FROM characters WHERE id = ? AND user_id = ?').run(backendChar.id, userId);
        deleted++;
        console.log(`🗑️  Deleted character ${backendChar.id} (not in IndexedDB)`);
      }
    }

    console.log(`✅ Synced ${synced} characters to backend (${skipped} skipped, ${deleted} deleted)`);

    res.json({
      success: true,
      synced,
      skipped,
      deleted,
      total: characters.length
    });
  } catch (error) {
    console.error('Sync characters error:', error);
    res.status(500).json({ error: 'Failed to sync characters' });
  }
});

/**
 * GET /api/sync/matched-characters
 * Get list of all character IDs that are currently matched (exist in backend)
 * Used by frontend to sync IndexedDB and remove orphaned characters
 */
router.get('/matched-characters', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    // Get all character IDs that exist in backend for this user
    const characters = db.prepare('SELECT id FROM characters WHERE user_id = ?').all(userId);
    const characterIds = characters.map(c => c.id);

    console.log(`📊 User ${userId} has ${characterIds.length} matched characters in backend`);

    res.json({
      success: true,
      characterIds,
      count: characterIds.length
    });
  } catch (error) {
    console.error('Get matched characters error:', error);
    res.status(500).json({ error: 'Failed to get matched characters' });
  }
});

/**
 * POST /api/sync/character-images
 * Sync character images from frontend IndexedDB to backend
 * Also generates thumbnails for sidebar display
 * Body: { characters: [{ id, imageUrl }] }
 */
router.post('/character-images', authenticateToken, async (req, res) => {
  try {
    const { characters } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(characters)) {
      return res.status(400).json({ error: 'Characters must be an array' });
    }

    let updated = 0;
    let skipped = 0;
    let thumbnailsGenerated = 0;

    for (const char of characters) {
      if (!char.id || !char.imageUrl) {
        skipped++;
        continue;
      }

      // Verify this character belongs to this user
      const existing = db.prepare('SELECT id, thumbnail_url FROM characters WHERE id = ? AND user_id = ?').get(char.id, userId);

      if (!existing) {
        skipped++;
        continue;
      }

      // Generate thumbnail if we don't have one yet
      let thumbnailUrl = existing.thumbnail_url;
      if (!thumbnailUrl) {
        thumbnailUrl = await generateThumbnail(char.imageUrl);
        if (thumbnailUrl) {
          thumbnailsGenerated++;
        }
      }

      // Update image_url and thumbnail_url
      db.prepare('UPDATE characters SET image_url = ?, thumbnail_url = ? WHERE id = ? AND user_id = ?')
        .run(char.imageUrl, thumbnailUrl, char.id, userId);

      updated++;
    }

    console.log(`✅ Synced ${updated} character images (${thumbnailsGenerated} thumbnails generated, ${skipped} skipped)`);

    res.json({
      success: true,
      updated,
      skipped,
      thumbnailsGenerated,
      total: characters.length
    });
  } catch (error) {
    console.error('Sync character images error:', error);
    res.status(500).json({ error: 'Failed to sync character images' });
  }
});

/**
 * GET /api/sync/character-thumbnails
 * Get all character thumbnails for the current user
 * Returns: { thumbnails: { [characterId]: thumbnailUrl } }
 */
router.get('/character-thumbnails', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    const characters = db.prepare('SELECT id, thumbnail_url FROM characters WHERE user_id = ?').all(userId);

    const thumbnails = {};
    for (const char of characters) {
      if (char.thumbnail_url) {
        thumbnails[char.id] = char.thumbnail_url;
      }
    }

    res.json({
      success: true,
      thumbnails
    });
  } catch (error) {
    console.error('Get character thumbnails error:', error);
    res.status(500).json({ error: 'Failed to get character thumbnails' });
  }
});

export default router;
