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
