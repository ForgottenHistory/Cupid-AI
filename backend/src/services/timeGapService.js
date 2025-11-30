import db from '../db/database.js';

/**
 * Centralized service for TIME GAP detection and marker insertion
 * Replaces fragile string-based detection with type-based system
 */
class TimeGapService {
  constructor() {
    // 30 minutes in milliseconds - standard threshold for session gaps
    this.SESSION_GAP_THRESHOLD = 30 * 60 * 1000;
  }

  /**
   * Calculate time gap between two timestamps
   * @param {string|Date} prevTimestamp - Previous message timestamp
   * @param {string|Date} currentTimestamp - Current message timestamp
   * @returns {number|null} Gap in hours, or null if gap is below threshold
   */
  calculateTimeGap(prevTimestamp, currentTimestamp) {
    const prevTime = new Date(prevTimestamp).getTime();
    const currentTime = new Date(currentTimestamp).getTime();
    const gapMs = currentTime - prevTime;

    if (gapMs >= this.SESSION_GAP_THRESHOLD) {
      return gapMs / (1000 * 60 * 60); // Convert to hours
    }

    return null;
  }

  /**
   * Check if a time gap should be inserted
   * @param {string|Date} prevTimestamp - Previous message timestamp
   * @param {string|Date} currentTimestamp - Current message timestamp
   * @param {number} thresholdMs - Optional custom threshold (default: 30 minutes)
   * @returns {boolean}
   */
  shouldInsertTimeGap(prevTimestamp, currentTimestamp, thresholdMs = null) {
    const threshold = thresholdMs || this.SESSION_GAP_THRESHOLD;
    const prevTime = new Date(prevTimestamp).getTime();
    const currentTime = new Date(currentTimestamp).getTime();
    const gapMs = currentTime - prevTime;

    return gapMs >= threshold;
  }

  /**
   * Insert a TIME GAP marker into the conversation
   * @param {number} conversationId - Conversation ID
   * @param {number} gapHours - Gap duration in hours
   * @param {string} timestamp - Optional timestamp for the marker (defaults to CURRENT_TIMESTAMP)
   * @returns {object} Saved TIME GAP message
   */
  insertTimeGapMarker(conversationId, gapHours, timestamp = null) {
    const content = this.formatTimeGapContent(gapHours);
    let result;

    if (timestamp) {
      // Insert with specific timestamp (for inserting between messages)
      result = db.prepare(`
        INSERT INTO messages (conversation_id, role, content, message_type, gap_duration_hours, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        conversationId,
        'system',
        content,
        'time_gap',
        gapHours,
        timestamp
      );
    } else {
      // Insert with CURRENT_TIMESTAMP
      result = db.prepare(`
        INSERT INTO messages (conversation_id, role, content, message_type, gap_duration_hours)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        conversationId,
        'system',
        content,
        'time_gap',
        gapHours
      );
    }

    return db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
  }

  /**
   * Check if a time gap should be inserted before the last message
   * If yes, inserts the marker between the second-to-last and last message
   * @param {number} conversationId - Conversation ID
   * @returns {boolean} True if gap was inserted, false otherwise
   */
  checkAndInsertTimeGap(conversationId) {
    // Get last 2 messages in conversation (excluding TIME GAP markers)
    const recentMessages = db.prepare(`
      SELECT id, created_at, message_type FROM messages
      WHERE conversation_id = ?
      AND message_type != 'time_gap'
      ORDER BY created_at DESC
      LIMIT 2
    `).all(conversationId);

    // Need at least 2 messages to detect a gap
    if (recentMessages.length < 2) {
      return false;
    }

    const lastMessage = recentMessages[0];
    const secondLastMessage = recentMessages[1];

    // Calculate gap between second-to-last and last message
    const gapHours = this.calculateTimeGap(secondLastMessage.created_at, lastMessage.created_at);

    if (gapHours !== null) {
      // Check if a TIME GAP marker already exists between these two messages
      const existingGap = db.prepare(`
        SELECT id FROM messages
        WHERE conversation_id = ?
        AND message_type = 'time_gap'
        AND created_at > ?
        AND created_at < ?
      `).get(conversationId, secondLastMessage.created_at, lastMessage.created_at);

      if (existingGap) {
        console.log(`⏰ TIME GAP marker already exists between messages - skipping`);
        return false;
      }

      // Insert TIME GAP marker with timestamp just before the last message
      // This ensures it appears chronologically between the two messages
      const lastMessageTime = new Date(lastMessage.created_at);
      const markerTimestamp = new Date(lastMessageTime.getTime() - 1000); // 1 second before
      const markerTimestampStr = markerTimestamp.toISOString().replace('T', ' ').replace('Z', '').substring(0, 19);

      this.insertTimeGapMarker(conversationId, gapHours, markerTimestampStr);
      console.log(`⏰ Inserted TIME GAP marker: ${gapHours.toFixed(1)} hours (between messages)`);
      return true;
    }

    return false;
  }

  /**
   * Check if a time gap should be inserted before a proactive message
   * Checks gap between last message and NOW (when proactive message will be sent)
   * @param {number} conversationId - Conversation ID
   * @returns {boolean} True if gap was inserted, false otherwise
   */
  checkAndInsertTimeGapForProactive(conversationId) {
    // Get last message in conversation (excluding TIME GAP markers)
    const lastMessage = db.prepare(`
      SELECT id, created_at, message_type FROM messages
      WHERE conversation_id = ?
      AND message_type != 'time_gap'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(conversationId);

    // Need at least 1 message to detect a gap
    if (!lastMessage) {
      return false;
    }

    // Calculate gap between last message and NOW
    const now = new Date();
    const gapHours = this.calculateTimeGap(lastMessage.created_at, now);

    if (gapHours !== null) {
      // Insert TIME GAP marker with timestamp just before NOW (the proactive message time)
      const markerTimestamp = new Date(now.getTime() - 1000); // 1 second before now
      const markerTimestampStr = markerTimestamp.toISOString().replace('T', ' ').replace('Z', '').substring(0, 19);

      this.insertTimeGapMarker(conversationId, gapHours, markerTimestampStr);
      console.log(`⏰ Inserted TIME GAP marker for proactive message: ${gapHours.toFixed(1)} hours`);
      return true;
    }

    return false;
  }

  /**
   * Combine consecutive TIME GAP markers into a single marker
   * Keeps the most recent one with summed duration, deletes the rest
   * @param {number} conversationId - Conversation ID
   * @returns {object} { deletedIds: number[], updatedId: number|null } - IDs of deleted and updated messages
   */
  combineConsecutiveTimeGaps(conversationId) {
    // Get all messages in order to find consecutive TIME GAPs
    const messages = db.prepare(`
      SELECT id, message_type, gap_duration_hours, created_at, content
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversationId);

    console.log(`🔍 Checking ${messages.length} messages for consecutive TIME GAPs`);

    const toDelete = [];
    let updatedId = null;

    let i = 0;
    while (i < messages.length) {
      if (messages[i].message_type === 'time_gap') {
        // Found a TIME GAP, look for consecutive ones
        const consecutiveGaps = [messages[i]];
        let j = i + 1;

        while (j < messages.length && messages[j].message_type === 'time_gap') {
          consecutiveGaps.push(messages[j]);
          j++;
        }

        if (consecutiveGaps.length > 1) {
          // Sum up all gap durations
          const totalHours = consecutiveGaps.reduce((sum, gap) => sum + (gap.gap_duration_hours || 0), 0);

          // Keep the last one (most recent), delete the rest
          const keepGap = consecutiveGaps[consecutiveGaps.length - 1];
          const deleteGaps = consecutiveGaps.slice(0, -1);

          // Update the kept gap with the total duration
          const newContent = this.formatTimeGapContent(totalHours);
          db.prepare(`
            UPDATE messages
            SET content = ?, gap_duration_hours = ?
            WHERE id = ?
          `).run(newContent, totalHours, keepGap.id);

          updatedId = keepGap.id;

          // Mark others for deletion
          toDelete.push(...deleteGaps.map(g => g.id));

          console.log(`⏰ Combined ${consecutiveGaps.length} TIME GAPs into one (${totalHours.toFixed(1)} hours total)`);
        }

        i = j;
      } else {
        i++;
      }
    }

    // Delete the redundant gaps
    if (toDelete.length > 0) {
      db.prepare(`DELETE FROM messages WHERE id IN (${toDelete.join(',')})`).run();
    }

    return { deletedIds: toDelete, updatedId };
  }

  /**
   * Get all TIME GAP markers in a conversation
   * @param {number} conversationId - Conversation ID
   * @returns {Array} Array of TIME GAP messages
   */
  getTimeGapMarkers(conversationId) {
    return db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      AND message_type = 'time_gap'
      ORDER BY created_at ASC
    `).all(conversationId);
  }

  /**
   * Check if a message is a TIME GAP marker (by type, not string parsing)
   * @param {object} message - Message object with message_type field
   * @returns {boolean}
   */
  isTimeGapMarker(message) {
    return message && message.message_type === 'time_gap';
  }

  /**
   * Format TIME GAP content for display
   * @param {number} gapHours - Gap duration in hours
   * @returns {string} Formatted content string
   */
  formatTimeGapContent(gapHours) {
    if (gapHours >= 24) {
      const days = (gapHours / 24).toFixed(1);
      return `[TIME GAP: ${days} days - NEW CONVERSATION SESSION]`;
    }
    return `[TIME GAP: ${gapHours.toFixed(1)} hours - NEW CONVERSATION SESSION]`;
  }
}

export default new TimeGapService();
