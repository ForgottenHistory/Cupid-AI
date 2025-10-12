import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Path to danbooru_tags.txt
const TAG_LIBRARY_PATH = path.join(__dirname, '../../danbooru_tags.txt');

/**
 * GET /api/tag-library
 * Get the current tag library content
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const content = fs.readFileSync(TAG_LIBRARY_PATH, 'utf-8');
    res.json({ content });
  } catch (error) {
    console.error('Failed to read tag library:', error);
    res.status(500).json({ error: 'Failed to read tag library' });
  }
});

/**
 * PUT /api/tag-library
 * Update the tag library content
 */
router.put('/', authenticateToken, (req, res) => {
  try {
    const { content } = req.body;

    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be a string' });
    }

    // Write to file
    fs.writeFileSync(TAG_LIBRARY_PATH, content, 'utf-8');

    // Reload tag library in imageTagGenerationService
    // Import dynamically to avoid circular dependency issues
    import('../services/imageTagGenerationService.js').then(module => {
      module.default.loadTagLibrary();
      console.log('✅ Tag library updated and reloaded');
    });

    res.json({ success: true, message: 'Tag library updated successfully' });
  } catch (error) {
    console.error('Failed to update tag library:', error);
    res.status(500).json({ error: 'Failed to update tag library' });
  }
});

export default router;
