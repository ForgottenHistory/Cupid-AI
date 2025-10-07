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
  calculateResponseDelay(currentStatus, engagementState, engagementMessagesRemaining, responseDelays) {
    // If engaged, use fast response time
    if (engagementState === 'engaged' && engagementMessagesRemaining > 0) {
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
      online: [30, 120],
      away: [300, 1200],
      busy: [900, 3600],
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
   * Sets a random burst of 2-5 fast messages
   */
  startEngagement(userId, characterId) {
    const burstSize = Math.floor(Math.random() * 4) + 2; // 2-5 messages

    this.updateEngagementState(userId, characterId, {
      engagement_state: 'engaged',
      engagement_messages_remaining: burstSize,
      last_check_time: new Date().toISOString()
    });

    console.log(`🔥 Character ${characterId} engaged! Burst of ${burstSize} fast messages`);
    return burstSize;
  }

  /**
   * Consume one engagement message (called after sending response)
   */
  consumeEngagementMessage(userId, characterId) {
    const state = this.getEngagementState(userId, characterId);
    if (!state) return;

    if (state.engagement_state === 'engaged' && state.engagement_messages_remaining > 0) {
      const remaining = state.engagement_messages_remaining - 1;

      if (remaining <= 0) {
        // Engagement ended, return to disengaged
        this.updateEngagementState(userId, characterId, {
          engagement_state: 'disengaged',
          engagement_messages_remaining: 0
        });
        console.log(`💤 Character ${characterId} disengaged`);
      } else {
        // Still engaged
        this.updateEngagementState(userId, characterId, {
          engagement_messages_remaining: remaining
        });
        console.log(`⚡ Character ${characterId} - ${remaining} fast messages remaining`);
      }
    }
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
