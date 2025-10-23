import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as aiGeneration from '../controllers/aiGenerationController.js';
import * as characterStatus from '../controllers/characterStatusController.js';
import * as characterInteraction from '../controllers/characterInteractionController.js';
import memoryService from '../services/memoryService.js';
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

// ===== Daily Auto-Match Route =====
router.post('/daily-auto-match', authenticateToken, characterInteraction.performDailyAutoMatch);
router.post('/reset-daily-match', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    db.prepare('UPDATE users SET last_auto_match_date = NULL WHERE id = ?').run(userId);
    console.log(`🔄 Reset daily auto-match for user ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to reset daily match:', error);
    res.status(500).json({ error: 'Failed to reset daily match' });
  }
});

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
    const { image_tags, contextual_tags } = req.body;
    const userId = req.user.id;

    console.log(`💾 Updating image tags for character ${characterId}:`, image_tags);
    console.log(`💾 Updating contextual tags for character ${characterId}:`, contextual_tags);

    // Update character image_tags and contextual_tags
    const result = db.prepare(`
      UPDATE characters
      SET image_tags = ?, contextual_tags = ?
      WHERE id = ? AND user_id = ?
    `).run(image_tags, contextual_tags, characterId, userId);

    console.log(`✅ Update result: ${result.changes} row(s) affected`);

    if (result.changes === 0) {
      console.error(`❌ Character ${characterId} not found in backend for user ${userId}`);
      return res.status(404).json({ error: 'Character not found. Please like/match with this character first to sync to backend.' });
    }

    // Verify the update by reading back
    const character = db.prepare('SELECT image_tags, contextual_tags FROM characters WHERE id = ? AND user_id = ?').get(characterId, userId);
    console.log(`📝 Verified image_tags in DB:`, character?.image_tags);
    console.log(`📝 Verified contextual_tags in DB:`, character?.contextual_tags);

    res.json({ success: true, image_tags: character?.image_tags, contextual_tags: character?.contextual_tags });
  } catch (error) {
    console.error('Failed to update character tags:', error);
    res.status(500).json({ error: 'Failed to update character tags' });
  }
});

// ===== Character Memories Route =====
router.get('/:characterId/memories', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    // Verify user has access to this character
    const character = db.prepare(`
      SELECT id FROM characters WHERE id = ? AND user_id = ?
    `).get(characterId, userId);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Get memories from memory service
    const memories = memoryService.getCharacterMemories(characterId);

    res.json({ memories });
  } catch (error) {
    console.error('Failed to get character memories:', error);
    res.status(500).json({ error: 'Failed to get character memories' });
  }
});

// ===== Delete Character Route =====
router.delete('/:characterId', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    // Delete character (CASCADE will handle related data like conversations, messages, posts)
    const result = db.prepare(`
      DELETE FROM characters WHERE id = ? AND user_id = ?
    `).run(characterId, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Character not found' });
    }

    console.log(`🗑️  Deleted character ${characterId}`);
    res.json({ success: true, characterId });
  } catch (error) {
    console.error('Failed to delete character:', error);
    res.status(500).json({ error: 'Failed to delete character' });
  }
});

export default router;
