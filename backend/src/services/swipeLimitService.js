import db from '../db/database.js';

class SwipeLimitService {
  /**
   * Check if user can swipe (under daily limit)
   */
  canSwipe(userId) {
    const user = db.prepare(`
      SELECT swipes_today, last_swipe_date, daily_swipe_limit FROM users WHERE id = ?
    `).get(userId);

    if (!user) return false;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const limit = user.daily_swipe_limit || 5; // Default to 5 if not set

    // 0 = unlimited
    if (limit === 0) return true;

    // Reset counter if it's a new day
    if (user.last_swipe_date !== today) {
      db.prepare(`
        UPDATE users
        SET swipes_today = 0, last_swipe_date = ?
        WHERE id = ?
      `).run(today, userId);
      return true;
    }

    // Check if under limit
    return user.swipes_today < limit;
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
      SELECT swipes_today, last_swipe_date, daily_swipe_limit FROM users WHERE id = ?
    `).get(userId);

    if (!user) return 5;

    const today = new Date().toISOString().split('T')[0];
    const limit = user.daily_swipe_limit || 5; // Default to 5 if not set

    // 0 = unlimited
    if (limit === 0) return Infinity;

    // If new day, full swipes available
    if (user.last_swipe_date !== today) {
      return limit;
    }

    return Math.max(0, limit - user.swipes_today);
  }
}

export default new SwipeLimitService();
