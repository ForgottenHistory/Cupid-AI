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
   * Calculate response delay
   * Returns delay in milliseconds (or null if offline)
   */
  calculateResponseDelay(currentStatus) {
    // If offline, no response
    if (currentStatus === 'offline') {
      return null;
    }

    // Fast responses (~1 second with some variance)
    const min = 500;  // 0.5 seconds
    const max = 2000; // 2 seconds
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Start engagement (character decides to engage in conversation)
   */
  startEngagement(userId, characterId) {
    this.updateEngagementState(userId, characterId, {
      engagement_state: 'engaged',
      engagement_messages_remaining: 0, // Not used anymore, but keep for schema compatibility
      engagement_started_at: new Date().toISOString(),
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

  /**
   * Check if engagement duration has expired based on status
   * Returns { expired: boolean, duration: number (in ms) }
   */
  checkEngagementDuration(engagementState, currentStatus) {
    if (!engagementState || engagementState.engagement_state !== 'engaged') {
      return { expired: false, duration: 0 };
    }

    if (!engagementState.engagement_started_at) {
      return { expired: false, duration: 0 };
    }

    const startTime = new Date(engagementState.engagement_started_at);
    const now = new Date();
    const durationMs = now - startTime;

    // Duration limits by status (in minutes)
    const durations = {
      online: null, // Unlimited
      away: [30, 60], // 30-60 min
      busy: [15, 30]  // 15-30 min
    };

    const limit = durations[currentStatus];

    // Online has no limit
    if (!limit) {
      return { expired: false, duration: durationMs };
    }

    // For away/busy, pick a random duration in the range (only calculate once)
    // We'll use a fixed max for simplicity - if exceeded, expired
    const maxDurationMs = limit[1] * 60 * 1000;

    return {
      expired: durationMs >= maxDurationMs,
      duration: durationMs
    };
  }

  /**
   * Check if character is on cooldown (can't respond until status changes)
   * Returns true if on cooldown
   */
  isOnCooldown(engagementState, currentStatus) {
    if (!engagementState || !engagementState.departed_status) {
      return false;
    }

    // If status has changed from when they departed, cooldown is over
    return engagementState.departed_status === currentStatus;
  }

  /**
   * Mark character as departed (start cooldown)
   */
  markDeparted(userId, characterId, currentStatus) {
    this.updateEngagementState(userId, characterId, {
      engagement_state: 'disengaged',
      departed_status: currentStatus,
      engagement_started_at: null
    });

    console.log(`👋 Character ${characterId} departed (cooldown until status changes)`);
  }

  /**
   * Clear cooldown (called when status changes)
   */
  clearCooldown(userId, characterId) {
    this.updateEngagementState(userId, characterId, {
      departed_status: null
    });

    console.log(`✅ Character ${characterId} cooldown cleared`);
  }
}

export default new EngagementService();
