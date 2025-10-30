import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import db from '../db/database.js';

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
 * Body: { characters: [{ id, imageUrl }] }
 */
router.post('/character-images', authenticateToken, (req, res) => {
  try {
    const { characters } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(characters)) {
      return res.status(400).json({ error: 'Characters must be an array' });
    }

    let updated = 0;
    let skipped = 0;

    for (const char of characters) {
      if (!char.id || !char.imageUrl) {
        skipped++;
        continue;
      }

      // Verify this character belongs to this user
      const existing = db.prepare('SELECT id FROM characters WHERE id = ? AND user_id = ?').get(char.id, userId);

      if (!existing) {
        skipped++;
        continue;
      }

      // Update image_url
      db.prepare('UPDATE characters SET image_url = ? WHERE id = ? AND user_id = ?')
        .run(char.imageUrl, char.id, userId);

      updated++;
    }

    console.log(`✅ Synced ${updated} character images (${skipped} skipped)`);

    res.json({
      success: true,
      updated,
      skipped,
      total: characters.length
    });
  } catch (error) {
    console.error('Sync character images error:', error);
    res.status(500).json({ error: 'Failed to sync character images' });
  }
});

export default router;
