import db from '../db/database.js';

class SwipeLimitService {
  /**
   * Check if user can swipe (under daily limit of 5)
   */
  canSwipe(userId) {
    const user = db.prepare(`
      SELECT swipes_today, last_swipe_date FROM users WHERE id = ?
    `).get(userId);

    if (!user) return false;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Reset counter if it's a new day
    if (user.last_swipe_date !== today) {
      db.prepare(`
        UPDATE users
        SET swipes_today = 0, last_swipe_date = ?
        WHERE id = ?
      `).run(today, userId);
      return true;
    }

    // Check if under limit (5 per day)
    return user.swipes_today < 5;
  }

  /**
   * Increment swipe counter
   */
  incrementSwipeCount(userId) {
    const today = new Date().toISOString().split('T')[0];
    db.prepare(`
      UPDATE users
      SET swipes_today = swipes_today + 1,
          last_swipe_date = ?
      WHERE id = ?
    `).run(today, userId);
  }

  /**
   * Get remaining swipes for today
   */
  getRemainingSwipes(userId) {
    const user = db.prepare(`
      SELECT swipes_today, last_swipe_date FROM users WHERE id = ?
    `).get(userId);

    if (!user) return 5;

    const today = new Date().toISOString().split('T')[0];

    // If new day, full 5 swipes available
    if (user.last_swipe_date !== today) {
      return 5;
    }

    return Math.max(0, 5 - user.swipes_today);
  }
}

export default new SwipeLimitService();
