import db from '../db/database.js';
import superLikeService from '../services/superLikeService.js';
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

    res.json({
      canSwipe,
      remaining,
      limit: 5
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
 * Like a character and check if it's a super like
 */
export async function likeCharacter(req, res) {
  try {
    const { characterId } = req.params;
    const { characterData } = req.body;
    const userId = req.user.id;

    if (!characterData) {
      return res.status(400).json({ error: 'Character data is required' });
    }

    // Check character's current status
    let currentStatus = 'online';
    if (characterData.schedule) {
      const statusInfo = calculateCurrentStatus(characterData.schedule);
      currentStatus = statusInfo.status;
    }

    // Get personality data if available
    const personality = characterData.personalityTraits || null;

    // Check if this should be a super like (based on extraversion)
    const isSuperLike = superLikeService.shouldSuperLike(userId, currentStatus, personality);

    // Extract image tags and image URL if available
    const imageTags = characterData.imageTags || null;
    const imageUrl = characterData.image || null; // Base64 image from card data

    // Create or update character in backend
    db.prepare(`
      INSERT OR REPLACE INTO characters (id, user_id, name, card_data, image_url, schedule_data, personality_data, image_tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      characterId,
      userId,
      characterData.name || 'Character',
      JSON.stringify(characterData),
      imageUrl,
      characterData.schedule ? JSON.stringify(characterData.schedule) : null,
      characterData.personalityTraits ? JSON.stringify(characterData.personalityTraits) : null,
      imageTags
    );

    // If super like, mark it
    if (isSuperLike) {
      superLikeService.markAsSuperLike(userId, characterId);
    }

    res.json({
      success: true,
      isSuperLike: isSuperLike,
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
    const { libraryCharacters } = req.body; // Array of character objects from IndexedDB
    const userId = req.user.id;

    if (!libraryCharacters || libraryCharacters.length === 0) {
      return res.json({ autoMatched: false, reason: 'No characters in library' });
    }

    // Check if user has already auto-matched today
    const user = db.prepare('SELECT last_auto_match_date FROM users WHERE id = ?').get(userId);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    if (user.last_auto_match_date === today) {
      return res.json({ autoMatched: false, reason: 'Already matched today' });
    }

    // Get all already matched character IDs for this user
    const matchedCharacterIds = db.prepare(`
      SELECT id FROM characters WHERE user_id = ?
    `).all(userId).map(c => c.id);

    // Filter out already matched characters
    const unmatchedCharacters = libraryCharacters.filter(
      char => !matchedCharacterIds.includes(char.id)
    );

    if (unmatchedCharacters.length === 0) {
      return res.json({ autoMatched: false, reason: 'All characters already matched' });
    }

    // Pick a random unmatched character
    const randomIndex = Math.floor(Math.random() * unmatchedCharacters.length);
    const selectedCharacter = unmatchedCharacters[randomIndex];
    const characterData = selectedCharacter.cardData?.data || selectedCharacter.data;

    if (!characterData) {
      return res.json({ autoMatched: false, reason: 'Invalid character data' });
    }

    // Get character status
    let currentStatus = 'online';
    if (characterData.schedule) {
      const statusInfo = calculateCurrentStatus(characterData.schedule);
      currentStatus = statusInfo.status;
    }

    // Extract image tags and image URL
    const imageTags = characterData.imageTags || null;
    const imageUrl = characterData.image || null;

    // Create character in backend (no super like for auto-match)
    db.prepare(`
      INSERT OR REPLACE INTO characters (id, user_id, name, card_data, image_url, schedule_data, personality_data, image_tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      selectedCharacter.id,
      userId,
      characterData.name || 'Character',
      JSON.stringify(characterData),
      imageUrl,
      characterData.schedule ? JSON.stringify(characterData.schedule) : null,
      characterData.personalityTraits ? JSON.stringify(characterData.personalityTraits) : null,
      imageTags
    );

    // Update last auto-match date
    db.prepare('UPDATE users SET last_auto_match_date = ? WHERE id = ?').run(today, userId);

    console.log(`✨ Daily auto-matched character ${characterData.name} for user ${userId}`);

    res.json({
      autoMatched: true,
      character: {
        id: selectedCharacter.id,
        name: characterData.name,
        image: imageUrl,
        status: currentStatus
      }
    });
  } catch (error) {
    console.error('Daily auto-match error:', error);
    res.status(500).json({ error: error.message || 'Failed to perform daily auto-match' });
  }
}
