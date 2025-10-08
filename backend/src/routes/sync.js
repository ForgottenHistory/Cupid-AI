import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import db from '../db/database.js';

const router = express.Router();

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
