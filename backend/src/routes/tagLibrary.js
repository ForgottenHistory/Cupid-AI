import express from 'express';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';
import { getUserConfigPath } from '../utils/userConfig.js';

const router = express.Router();

/**
 * Load tag library for a specific user
 */
const loadTagLibrary = (userId) => {
  const configPath = getUserConfigPath(userId, 'tagLibrary');

  try {
    return fs.readFileSync(configPath, 'utf-8');
  } catch (error) {
    console.error('Failed to read tag library:', error);
    return '';
  }
};

/**
 * GET /api/tag-library
 * Get the current tag library content for the authenticated user
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const content = loadTagLibrary(req.user.id);
    res.json({ content });
  } catch (error) {
    console.error('Failed to read tag library:', error);
    res.status(500).json({ error: 'Failed to read tag library' });
  }
});

/**
 * PUT /api/tag-library
 * Update the tag library content for the authenticated user
 */
router.put('/', authenticateToken, (req, res) => {
  try {
    const { content } = req.body;

    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be a string' });
    }

    const configPath = getUserConfigPath(req.user.id, 'tagLibrary');
    fs.writeFileSync(configPath, content, 'utf-8');

    console.log(`✅ Tag library updated for user ${req.user.id}`);
    res.json({ success: true, message: 'Tag library updated successfully' });
  } catch (error) {
    console.error('Failed to update tag library:', error);
    res.status(500).json({ error: 'Failed to update tag library' });
  }
});

// Export for use in imageTagGenerationService
export { loadTagLibrary };

export default router;
