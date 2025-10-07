import db from '../db/database.js';

class SuperLikeService {
  /**
   * Check if user has reached daily super like limit (2 per day)
   */
  checkDailyLimit(userId) {
    const user = db.prepare(`
      SELECT super_likes_today, last_super_like_date FROM users WHERE id = ?
    `).get(userId);

    if (!user) return false;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Reset counter if it's a new day
    if (user.last_super_like_date !== today) {
      db.prepare(`
        UPDATE users
        SET super_likes_today = 0, last_super_like_date = ?
        WHERE id = ?
      `).run(today, userId);
      return true; // Can send
    }

    // Check if under limit (2 per day)
    return user.super_likes_today < 2;
  }

  /**
   * Increment super like counter for user
   */
  incrementSuperLikeCount(userId) {
    const today = new Date().toISOString().split('T')[0];
    db.prepare(`
      UPDATE users
      SET super_likes_today = super_likes_today + 1,
          last_super_like_date = ?
      WHERE id = ?
    `).run(today, userId);
  }

  /**
   * Check if this should be a super like
   * Probability based on extraversion (0-10%), only if under daily limit and character is online
   */
  shouldSuperLike(userId, characterStatus, personality) {
    // Must be online
    if (characterStatus !== 'online') {
      return false;
    }

    // Check daily limit
    if (!this.checkDailyLimit(userId)) {
      return false;
    }

    // Calculate probability based on extraversion
    // Extraversion 0 = 0%, Extraversion 50 = 5%, Extraversion 100 = 10%
    const extraversion = personality?.extraversion || 50;
    const probability = extraversion / 10; // 0-10%

    // Random roll
    const roll = Math.random() * 100;
    return roll < probability;
  }

  /**
   * Mark a character as a super like
   */
  markAsSuperLike(userId, characterId) {
    db.prepare(`
      UPDATE characters
      SET is_super_like = 1
      WHERE user_id = ? AND id = ?
    `).run(userId, characterId);

    this.incrementSuperLikeCount(userId);
  }

  /**
   * Check if a character is a super like
   */
  isSuperLike(userId, characterId) {
    const character = db.prepare(`
      SELECT is_super_like FROM characters
      WHERE user_id = ? AND id = ?
    `).get(userId, characterId);

    return character?.is_super_like === 1;
  }
}

export default new SuperLikeService();
