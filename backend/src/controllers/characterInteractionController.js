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
 * Like a character (match)
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
    const { libraryCharacters } = req.body; // Array of character objects from IndexedDB
    const userId = req.user.id;

    console.log(`📅 Daily auto-match check for user ${userId}`);

    if (!libraryCharacters || libraryCharacters.length === 0) {
      console.log('  ⏭️ No characters in library');
      return res.json({ autoMatched: false, reason: 'No characters in library' });
    }

    // Check if user has already auto-matched today
    const user = db.prepare('SELECT last_auto_match_date FROM users WHERE id = ?').get(userId);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`  📆 Last auto-match: ${user.last_auto_match_date}, Today: ${today}`);

    if (user.last_auto_match_date === today) {
      console.log('  ⏭️ Already matched today');
      return res.json({ autoMatched: false, reason: 'Already matched today' });
    }

    console.log(`  📚 Unmatched characters received: ${libraryCharacters.length}`);

    if (libraryCharacters.length === 0) {
      console.log('  ⏭️ No unmatched characters available');
      return res.json({ autoMatched: false, reason: 'No unmatched characters available' });
    }

    // Pick a random unmatched character (frontend already filtered to only unmatched)
    const randomIndex = Math.floor(Math.random() * libraryCharacters.length);
    const selectedCharacter = libraryCharacters[randomIndex];
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
