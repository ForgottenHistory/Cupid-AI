import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as aiGeneration from '../controllers/aiGenerationController.js';
import * as characterStatus from '../controllers/characterStatusController.js';
import * as characterInteraction from '../controllers/characterInteractionController.js';
import db from '../db/database.js';

const router = express.Router();

// ===== AI Generation Routes =====
router.post('/cleanup-description', authenticateToken, aiGeneration.cleanupDescription);
router.post('/generate-dating-profile', authenticateToken, aiGeneration.generateDatingProfile);
router.post('/generate-schedule', authenticateToken, aiGeneration.generateSchedule);
router.post('/generate-personality', authenticateToken, aiGeneration.generatePersonality);

// ===== Status Routes =====
router.get('/:characterId/status', authenticateToken, characterStatus.getCharacterStatus);
router.post('/:characterId/status', authenticateToken, characterStatus.calculateStatus);
router.get('/:characterId/engagement', authenticateToken, characterStatus.getEngagement);

// ===== Swipe/Like Routes =====
router.get('/swipe-limit', authenticateToken, characterInteraction.getSwipeLimit);
router.post('/swipe', authenticateToken, characterInteraction.recordSwipe);
router.post('/:characterId/like', authenticateToken, characterInteraction.likeCharacter);

// ===== Voice Assignment Route =====
router.put('/:characterId/voice', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const { voice_id } = req.body;
    const userId = req.user.id;

    // Update character voice_id
    db.prepare(`
      UPDATE characters
      SET voice_id = ?
      WHERE id = ? AND user_id = ?
    `).run(voice_id, characterId, userId);

    res.json({ success: true, voice_id });
  } catch (error) {
    console.error('Failed to update character voice:', error);
    res.status(500).json({ error: 'Failed to update character voice' });
  }
});

// ===== Get Character Data Route =====
router.get('/:characterId', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    const character = db.prepare(`
      SELECT * FROM characters WHERE id = ? AND user_id = ?
    `).get(characterId, userId);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    res.json(character);
  } catch (error) {
    console.error('Failed to get character:', error);
    res.status(500).json({ error: 'Failed to get character' });
  }
});

// ===== Image Tags Assignment Route =====
router.put('/:characterId/image-tags', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const { image_tags } = req.body;
    const userId = req.user.id;

    // Update character image_tags
    db.prepare(`
      UPDATE characters
      SET image_tags = ?
      WHERE id = ? AND user_id = ?
    `).run(image_tags, characterId, userId);

    res.json({ success: true, image_tags });
  } catch (error) {
    console.error('Failed to update character image tags:', error);
    res.status(500).json({ error: 'Failed to update character image tags' });
  }
});

export default router;
