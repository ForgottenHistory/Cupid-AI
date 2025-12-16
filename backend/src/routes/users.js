import express from 'express';
import profileRoutes from './users/profile.js';
import llmSettingsRoutes from './users/llmSettings.js';
import sdSettingsRoutes from './users/sdSettings.js';
import behaviorSettingsRoutes from './users/behaviorSettings.js';

const router = express.Router();

// Mount sub-routes
router.use('/profile', profileRoutes);
router.use('/', llmSettingsRoutes);  // LLM settings at root level (/llm-settings, /decision-llm-settings, etc.)
router.use('/sd-settings', sdSettingsRoutes);
router.use('/behavior-settings', behaviorSettingsRoutes);

// Keep account deletion at root level for backwards compatibility
import { authenticateToken } from '../middleware/auth.js';
import db from '../db/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * DELETE /api/users/account
 * Delete user account and all associated data
 */
router.delete('/account', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = db.prepare('SELECT id FROM conversations WHERE user_id = ?').all(userId);
    const conversationIds = conversations.map(c => c.id);

    if (conversationIds.length > 0) {
      const placeholders = conversationIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM messages WHERE conversation_id IN (${placeholders})`).run(...conversationIds);
    }

    db.prepare('DELETE FROM conversations WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM character_states WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM characters WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM posts WHERE user_id = ?').run(userId);

    const userConfigDir = path.join(__dirname, '..', '..', 'config', 'users', String(userId));
    if (fs.existsSync(userConfigDir)) {
      fs.rmSync(userConfigDir, { recursive: true, force: true });
      console.log(`🗑️ Deleted user config directory: ${userConfigDir}`);
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    console.log(`🗑️ Deleted user account: ${userId}`);

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
