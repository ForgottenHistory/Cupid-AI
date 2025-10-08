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

    for (const char of characters) {
      if (!char.id || !char.cardData) {
        skipped++;
        continue;
      }

      try {
        // Extract name from card data
        const name = char.cardData?.data?.name || 'Character';
        const imageTags = char.cardData?.data?.imageTags || null;

        // Check if character already exists
        const existing = db.prepare('SELECT id FROM characters WHERE id = ? AND user_id = ?').get(char.id, userId);

        if (existing) {
          // Update existing character (preserve schedule, personality, etc.)
          db.prepare(`
            UPDATE characters
            SET name = ?, card_data = ?, image_url = ?, image_tags = ?
            WHERE id = ? AND user_id = ?
          `).run(
            name,
            JSON.stringify(char.cardData),
            char.imageUrl || null,
            imageTags ? JSON.stringify(imageTags) : null,
            char.id,
            userId
          );
        } else {
          // Insert new character
          db.prepare(`
            INSERT INTO characters
            (id, user_id, name, card_data, image_url, image_tags, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(
            char.id,
            userId,
            name,
            JSON.stringify(char.cardData),
            char.imageUrl || null,
            imageTags ? JSON.stringify(imageTags) : null
          );
        }

        synced++;
      } catch (error) {
        console.error(`Failed to sync character ${char.id}:`, error);
        skipped++;
      }
    }

    console.log(`✅ Synced ${synced} characters to backend (${skipped} skipped)`);

    res.json({
      success: true,
      synced,
      skipped,
      total: characters.length
    });
  } catch (error) {
    console.error('Sync characters error:', error);
    res.status(500).json({ error: 'Failed to sync characters' });
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
