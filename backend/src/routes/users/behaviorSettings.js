import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import db from '../../db/database.js';

const router = express.Router();

/**
 * Behavior settings validation rules
 */
const BEHAVIOR_VALIDATION = {
  proactiveMessageHours: { min: 1, max: 24, error: 'Proactive message hours must be between 1 and 24' },
  dailyProactiveLimit: { min: 0, max: 20, error: 'Daily proactive limit must be between 0 and 20' },
  proactiveOnlineChance: { min: 0, max: 100, error: 'Proactive online chance must be between 0 and 100' },
  proactiveAwayChance: { min: 0, max: 100, error: 'Proactive away chance must be between 0 and 100' },
  proactiveBusyChance: { min: 0, max: 100, error: 'Proactive busy chance must be between 0 and 100' },
  proactiveCheckInterval: { min: 5, max: 300, error: 'Proactive check interval must be between 5 and 300 minutes' },
  maxConsecutiveProactive: { min: 0, max: 10, error: 'Max consecutive proactive must be between 0 and 10' },
  proactiveCooldownMultiplier: { min: 1.0, max: 5.0, error: 'Proactive cooldown multiplier must be between 1.0 and 5.0' },
  compactThresholdPercent: { min: 50, max: 100, error: 'Compact threshold must be between 50 and 100 percent' },
  compactTargetPercent: { min: 30, max: 90, error: 'Compact target must be between 30 and 90 percent' },
  keepUncompactedMessages: { min: 10, max: 100, error: 'Keep uncompacted messages must be between 10 and 100' },
  autoUnmatchInactiveDays: { min: 0, max: 90, error: 'Auto-unmatch inactive days must be between 0 and 90' },
  dailySwipeLimit: { min: 0, max: 10, error: 'Daily swipe limit must be between 0 and 10' },
  maxMemories: { min: 0, max: 100, error: 'Max memories must be between 0 and 100' },
  maxMatches: { min: 0, max: 50, error: 'Max matches must be between 0 and 50' },
  thoughtFrequency: { min: 0, max: 25, error: 'Thought frequency must be between 0 and 25' },
  memoryDegradationPoints: { min: 0, max: 100, error: 'Memory degradation points must be between 0 and 100' }
};

/**
 * Map from camelCase to database column names
 */
const FIELD_TO_COLUMN = {
  proactiveMessageHours: 'proactive_message_hours',
  dailyProactiveLimit: 'daily_proactive_limit',
  proactiveOnlineChance: 'proactive_online_chance',
  proactiveAwayChance: 'proactive_away_chance',
  proactiveBusyChance: 'proactive_busy_chance',
  pacingStyle: 'pacing_style',
  proactiveCheckInterval: 'proactive_check_interval',
  maxConsecutiveProactive: 'max_consecutive_proactive',
  proactiveCooldownMultiplier: 'proactive_cooldown_multiplier',
  compactThresholdPercent: 'compact_threshold_percent',
  compactTargetPercent: 'compact_target_percent',
  keepUncompactedMessages: 'keep_uncompacted_messages',
  autoUnmatchInactiveDays: 'auto_unmatch_inactive_days',
  autoUnmatchAfterProactive: 'auto_unmatch_after_proactive',
  allowAiUnmatch: 'allow_ai_unmatch',
  dailySwipeLimit: 'daily_swipe_limit',
  dailyAutoMatchEnabled: 'daily_auto_match_enabled',
  compactionEnabled: 'compaction_enabled',
  maxMemories: 'max_memories',
  maxMatches: 'max_matches',
  thoughtFrequency: 'thought_frequency',
  memoryDegradationPoints: 'memory_degradation_points',
  includeFullSchedule: 'include_full_schedule',
  retryOnInvalidResponse: 'retry_on_invalid_response'
};

/**
 * Boolean fields that need conversion
 */
const BOOLEAN_FIELDS = ['autoUnmatchAfterProactive', 'allowAiUnmatch', 'dailyAutoMatchEnabled', 'compactionEnabled', 'includeFullSchedule', 'retryOnInvalidResponse'];

/**
 * GET /api/users/behavior-settings
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const columns = Object.values(FIELD_TO_COLUMN).join(', ');
    const settings = db.prepare(`SELECT ${columns} FROM users WHERE id = ?`).get(req.user.id);

    if (!settings) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Map database columns to camelCase response
    const response = {};
    for (const [camelCase, column] of Object.entries(FIELD_TO_COLUMN)) {
      if (BOOLEAN_FIELDS.includes(camelCase)) {
        response[camelCase] = Boolean(settings[column]);
      } else {
        response[camelCase] = settings[column];
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Get behavior settings error:', error);
    res.status(500).json({ error: 'Failed to get behavior settings' });
  }
});

/**
 * PUT /api/users/behavior-settings
 */
router.put('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    // Validate parameters
    for (const [field, rule] of Object.entries(BEHAVIOR_VALIDATION)) {
      const value = req.body[field];
      if (value !== undefined) {
        if (value < rule.min || value > rule.max) {
          return res.status(400).json({ error: rule.error });
        }
      }
    }

    // Validate pacing style
    if (req.body.pacingStyle !== undefined && !['slow', 'balanced', 'forward'].includes(req.body.pacingStyle)) {
      return res.status(400).json({ error: 'Pacing style must be slow, balanced, or forward' });
    }

    // Validate boolean
    if (req.body.autoUnmatchAfterProactive !== undefined && typeof req.body.autoUnmatchAfterProactive !== 'boolean') {
      return res.status(400).json({ error: 'Auto-unmatch after proactive must be a boolean' });
    }

    // Build update query
    const updates = [];
    const values = [];

    for (const [camelCase, column] of Object.entries(FIELD_TO_COLUMN)) {
      const value = req.body[camelCase];
      if (value !== undefined) {
        updates.push(`${column} = ?`);
        if (BOOLEAN_FIELDS.includes(camelCase)) {
          values.push(value ? 1 : 0);
        } else {
          values.push(value);
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    // Get updated settings
    const columns = Object.values(FIELD_TO_COLUMN).join(', ');
    const settings = db.prepare(`SELECT ${columns} FROM users WHERE id = ?`).get(userId);

    const response = {};
    for (const [camelCase, column] of Object.entries(FIELD_TO_COLUMN)) {
      if (BOOLEAN_FIELDS.includes(camelCase)) {
        response[camelCase] = Boolean(settings[column]);
      } else {
        response[camelCase] = settings[column];
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Update behavior settings error:', error);
    res.status(500).json({ error: 'Failed to update behavior settings' });
  }
});

export default router;
