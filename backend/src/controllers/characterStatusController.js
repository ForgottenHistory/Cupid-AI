import db from '../db/database.js';
import { calculateCurrentStatus } from '../utils/characterHelpers.js';

/**
 * GET /api/characters/:characterId/status
 * Get current status for a character based on their schedule
 */
export async function getCharacterStatus(req, res) {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    // Get character from database
    const character = db.prepare(`
      SELECT * FROM characters
      WHERE id = ? AND user_id = ?
    `).get(characterId, userId);

    if (!character) {
      console.log(`Character ${characterId} not found in backend for user ${userId}`);
      // Return default online status instead of error
      return res.json({ status: 'online', activity: null, nextChange: null });
    }

    // Parse schedule if it exists
    let schedule = null;
    if (character.schedule_data) {
      try {
        schedule = JSON.parse(character.schedule_data);
      } catch (parseError) {
        console.error('Failed to parse schedule:', parseError);
      }
    }

    // Calculate current status
    const statusInfo = calculateCurrentStatus(schedule);
    res.json(statusInfo);
  } catch (error) {
    console.error('Get character status error:', {
      message: error.message,
      stack: error.stack,
      characterId: req.params.characterId
    });
    res.status(500).json({ error: error.message || 'Failed to get character status' });
  }
}

/**
 * POST /api/characters/:characterId/status
 * Calculate current status from character's schedule
 */
export async function calculateStatus(req, res) {
  try {
    const { characterId } = req.params;
    const { schedule } = req.body;

    if (!schedule) {
      return res.json({ status: 'online', activity: null, nextChange: null });
    }

    const statusInfo = calculateCurrentStatus(schedule);
    res.json(statusInfo);
  } catch (error) {
    console.error('Calculate status error:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate status' });
  }
}

/**
 * GET /api/characters/:characterId/engagement
 * Get engagement state for a character
 */
export async function getEngagement(req, res) {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    const engagementState = db.prepare(`
      SELECT engagement_state FROM character_states
      WHERE user_id = ? AND character_id = ?
    `).get(userId, characterId);

    res.json({
      isEngaged: engagementState?.engagement_state === 'engaged'
    });
  } catch (error) {
    console.error('Get engagement state error:', error);
    res.status(500).json({ error: error.message || 'Failed to get engagement state' });
  }
}
