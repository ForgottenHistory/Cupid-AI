import db from '../db/database.js';
import swipeLimitService from '../services/swipeLimitService.js';
import { calculateCurrentStatus } from '../utils/characterHelpers.js';

/**
 * GET /api/characters/swipe-limit
 * Check if user can swipe today
 */
export function getSwipeLimit(req, res) {
  try {
    const userId = req.user.id;
    const canSwipe = swipeLimitService.canSwipe(userId);
    const remaining = swipeLimitService.getRemainingSwipes(userId);
    const { used, limit } = swipeLimitService.getSwipeStats(userId);

    res.json({
      canSwipe,
      remaining,
      used,
      limit
    });
  } catch (error) {
    console.error('Check swipe limit error:', error);
    res.status(500).json({ error: error.message || 'Failed to check swipe limit' });
  }
}

/**
 * POST /api/characters/swipe
 * Record a swipe (increment counter)
 */
export function recordSwipe(req, res) {
  try {
    const userId = req.user.id;

    // Check if can swipe
    if (!swipeLimitService.canSwipe(userId)) {
      return res.status(429).json({ error: 'Daily swipe limit reached' });
    }

    // Increment counter
    swipeLimitService.incrementSwipeCount(userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Record swipe error:', error);
    res.status(500).json({ error: error.message || 'Failed to record swipe' });
  }
}

/**
 * POST /api/characters/:characterId/like
 * Like a character (match)
 */
export async function likeCharacter(req, res) {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    // Check if character exists
    const existingChar = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(characterId, userId);

    if (!existingChar) {
      return res.status(404).json({ error: 'Character not found. Please import the character first.' });
    }

    // Check max matches limit (only count characters with active conversations)
    const user = db.prepare('SELECT max_matches FROM users WHERE id = ?').get(userId);
    const maxMatches = user?.max_matches || 0;

    if (maxMatches > 0) {
      const currentMatches = db.prepare(`
        SELECT COUNT(DISTINCT c.id) as count
        FROM characters c
        INNER JOIN conversations conv ON c.id = conv.character_id AND conv.user_id = ?
        WHERE c.user_id = ?
      `).get(userId, userId);
      if (currentMatches.count >= maxMatches) {
        return res.status(400).json({ error: `Maximum matches limit reached (${maxMatches}). Unmatch characters to make room for new matches.` });
      }
    }

    // Get character's current status from stored schedule
    let currentStatus = 'online';
    const cardData = JSON.parse(existingChar.card_data || '{}');
    const schedule = existingChar.schedule_data ? JSON.parse(existingChar.schedule_data) : cardData.data?.schedule;
    if (schedule) {
      const statusInfo = calculateCurrentStatus(schedule);
      currentStatus = statusInfo.status;
    }

    // Mark character as liked
    db.prepare(`
      UPDATE characters
      SET is_liked = 1, liked_at = ?
      WHERE id = ? AND user_id = ?
    `).run(Date.now(), characterId, userId);

    res.json({
      success: true,
      characterStatus: currentStatus
    });
  } catch (error) {
    console.error('Like character error:', error);
    res.status(500).json({ error: error.message || 'Failed to like character' });
  }
}

/**
 * POST /api/characters/daily-auto-match
 * Automatically match one character per day from library
 */
export async function performDailyAutoMatch(req, res) {
  try {
    const userId = req.user.id;

    console.log(`📅 Daily auto-match check for user ${userId}`);

    // Check if daily auto-match is enabled for this user
    const user = db.prepare('SELECT last_auto_match_date, max_matches, daily_auto_match_enabled FROM users WHERE id = ?').get(userId);

    if (!user.daily_auto_match_enabled) {
      console.log('  ⏭️ Daily auto-match disabled');
      return res.json({ autoMatched: false, reason: 'Daily auto-match is disabled' });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`  📆 Last auto-match: ${user.last_auto_match_date}, Today: ${today}`);

    if (user.last_auto_match_date === today) {
      console.log('  ⏭️ Already matched today');
      return res.json({ autoMatched: false, reason: 'Already matched today' });
    }

    // Check max matches limit (only count characters with active conversations)
    const maxMatches = user?.max_matches || 0;
    if (maxMatches > 0) {
      const currentMatches = db.prepare(`
        SELECT COUNT(DISTINCT c.id) as count
        FROM characters c
        INNER JOIN conversations conv ON c.id = conv.character_id AND conv.user_id = ?
        WHERE c.user_id = ?
      `).get(userId, userId);
      if (currentMatches.count >= maxMatches) {
        console.log(`  ⏭️ Max matches limit reached (${currentMatches.count}/${maxMatches})`);
        return res.json({ autoMatched: false, reason: `Maximum matches limit reached (${maxMatches})` });
      }
    }

    // Get unmatched characters from backend database
    const unmatchedCharacters = db.prepare(`
      SELECT id, name, card_data, image_url, schedule_data
      FROM characters
      WHERE user_id = ? AND is_liked = 0
    `).all(userId);

    console.log(`  📚 Unmatched characters in database: ${unmatchedCharacters.length}`);

    if (unmatchedCharacters.length === 0) {
      console.log('  ⏭️ No unmatched characters available');
      return res.json({ autoMatched: false, reason: 'No unmatched characters available' });
    }

    // Pick a random unmatched character
    const randomIndex = Math.floor(Math.random() * unmatchedCharacters.length);
    const selectedCharacter = unmatchedCharacters[randomIndex];
    const characterData = JSON.parse(selectedCharacter.card_data || '{}');

    // Get character status
    let currentStatus = 'online';
    const scheduleData = selectedCharacter.schedule_data ? JSON.parse(selectedCharacter.schedule_data) : characterData.data?.schedule;
    if (scheduleData) {
      const statusInfo = calculateCurrentStatus(scheduleData);
      currentStatus = statusInfo.status;
    }

    // Mark character as liked (no INSERT needed, character already exists)
    db.prepare(`
      UPDATE characters
      SET is_liked = 1, liked_at = ?
      WHERE id = ? AND user_id = ?
    `).run(Date.now(), selectedCharacter.id, userId);

    // Update last auto-match date
    db.prepare('UPDATE users SET last_auto_match_date = ? WHERE id = ?').run(today, userId);

    console.log(`✨ Daily auto-matched character ${selectedCharacter.name} for user ${userId}`);

    res.json({
      autoMatched: true,
      character: {
        id: selectedCharacter.id,
        name: selectedCharacter.name,
        image: selectedCharacter.image_url,
        status: currentStatus
      }
    });
  } catch (error) {
    console.error('Daily auto-match error:', error);
    res.status(500).json({ error: error.message || 'Failed to perform daily auto-match' });
  }
}
