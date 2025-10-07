import db from '../db/database.js';

class EngagementService {
  /**
   * Get or create engagement state for a character
   */
  getEngagementState(userId, characterId) {
    try {
      let state = db.prepare(`
        SELECT * FROM character_states
        WHERE user_id = ? AND character_id = ?
      `).get(userId, characterId);

      if (!state) {
        // Create new state (default: disengaged)
        try {
          db.prepare(`
            INSERT INTO character_states (
              user_id,
              character_id,
              current_status,
              engagement_state,
              engagement_messages_remaining,
              last_check_time
            ) VALUES (?, ?, 'online', 'disengaged', 0, CURRENT_TIMESTAMP)
          `).run(userId, characterId);

          state = db.prepare(`
            SELECT * FROM character_states
            WHERE user_id = ? AND character_id = ?
          `).get(userId, characterId);
        } catch (insertError) {
          console.error('Failed to create engagement state:', insertError);
          // Return null if we can't create the state (e.g., foreign key constraint)
          return null;
        }
      }

      return state;
    } catch (error) {
      console.error('Get engagement state error:', error);
      return null;
    }
  }

  /**
   * Update engagement state
   */
  updateEngagementState(userId, characterId, updates) {
    try {
      const setParts = [];
      const values = [];

      if (updates.current_status !== undefined) {
        setParts.push('current_status = ?');
        values.push(updates.current_status);
      }
      if (updates.engagement_state !== undefined) {
        setParts.push('engagement_state = ?');
        values.push(updates.engagement_state);
      }
      if (updates.engagement_messages_remaining !== undefined) {
        setParts.push('engagement_messages_remaining = ?');
        values.push(updates.engagement_messages_remaining);
      }
      if (updates.last_check_time !== undefined) {
        setParts.push('last_check_time = ?');
        values.push(updates.last_check_time);
      }

      setParts.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId, characterId);

      db.prepare(`
        UPDATE character_states
        SET ${setParts.join(', ')}
        WHERE user_id = ? AND character_id = ?
      `).run(...values);

      return true;
    } catch (error) {
      console.error('Update engagement state error:', error);
      return false;
    }
  }

  /**
   * Calculate response delay based on current status and engagement
   * Returns delay in milliseconds
   */
  calculateResponseDelay(currentStatus, engagementState, responseDelays) {
    // If engaged, use fast response time
    if (engagementState === 'engaged') {
      const min = 5000; // 5 seconds
      const max = 15000; // 15 seconds
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // If offline, no response (return very large delay as signal)
    if (currentStatus === 'offline') {
      return null; // Signal that character won't respond
    }

    // Use status-based initial delay
    const delays = responseDelays || {
      online: [30, 120],      // 30sec - 2min
      away: [300, 1200],      // 5-20min
      busy: [900, 3600],      // 15-60min
      offline: null
    };

    const delayRange = delays[currentStatus] || delays.online;
    if (!delayRange) return null;

    const [minSeconds, maxSeconds] = delayRange;
    const delaySeconds = Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
    return delaySeconds * 1000; // Convert to milliseconds
  }

  /**
   * Start engagement (character decides to engage in conversation)
   */
  startEngagement(userId, characterId) {
    this.updateEngagementState(userId, characterId, {
      engagement_state: 'engaged',
      engagement_messages_remaining: 0, // Not used anymore, but keep for schema compatibility
      last_check_time: new Date().toISOString()
    });

    console.log(`🔥 Character ${characterId} engaged!`);
  }

  /**
   * End engagement (character decides to disengage)
   */
  endEngagement(userId, characterId) {
    this.updateEngagementState(userId, characterId, {
      engagement_state: 'disengaged',
      engagement_messages_remaining: 0
    });

    console.log(`💤 Character ${characterId} disengaged`);
  }

  /**
   * Update current status from schedule
   */
  updateCurrentStatus(userId, characterId, status) {
    this.updateEngagementState(userId, characterId, {
      current_status: status
    });
  }
}

export default new EngagementService();
