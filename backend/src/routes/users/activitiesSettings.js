import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import db from '../../db/database.js';

const router = express.Router();

// Field mapping from camelCase to database column names
const FIELD_TO_COLUMN = {
  activitiesIncludeAway: 'activities_include_away',
  activitiesIncludeBusy: 'activities_include_busy',
  activitiesChatDuration: 'activities_chat_duration',
  activitiesUserFirstChance: 'activities_user_first_chance',
};

const BOOLEAN_FIELDS = ['activitiesIncludeAway', 'activitiesIncludeBusy'];

// Validation rules
const VALIDATION = {
  activitiesChatDuration: { min: 1, max: 30, error: 'Chat duration must be 1-30 minutes' },
  activitiesUserFirstChance: { min: 0, max: 100, error: 'User first chance must be 0-100%' },
};

// Default values
const DEFAULTS = {
  activitiesIncludeAway: false,
  activitiesIncludeBusy: false,
  activitiesChatDuration: 10,
  activitiesUserFirstChance: 50,
};

/**
 * GET /api/users/activities-settings
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
      if (settings[column] === null || settings[column] === undefined) {
        // Use default if not set
        response[camelCase] = DEFAULTS[camelCase];
      } else if (BOOLEAN_FIELDS.includes(camelCase)) {
        response[camelCase] = Boolean(settings[column]);
      } else {
        response[camelCase] = settings[column];
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Get activities settings error:', error);
    res.status(500).json({ error: 'Failed to get activities settings' });
  }
});

/**
 * PUT /api/users/activities-settings
 */
router.put('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    // Validate parameters
    for (const [field, rule] of Object.entries(VALIDATION)) {
      const value = req.body[field];
      if (value !== undefined) {
        if (value < rule.min || value > rule.max) {
          return res.status(400).json({ error: rule.error });
        }
      }
    }

    // Build update query
    const updates = [];
    const values = [];

    for (const [camelCase, column] of Object.entries(FIELD_TO_COLUMN)) {
      if (req.body[camelCase] !== undefined) {
        updates.push(`${column} = ?`);
        if (BOOLEAN_FIELDS.includes(camelCase)) {
          values.push(req.body[camelCase] ? 1 : 0);
        } else {
          values.push(req.body[camelCase]);
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(userId);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ message: 'Activities settings updated' });
  } catch (error) {
    console.error('Update activities settings error:', error);
    res.status(500).json({ error: 'Failed to update activities settings' });
  }
});

export default router;
