import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../../middleware/auth.js';
import db from '../../db/database.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for profile image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

/**
 * GET /api/users/profile
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, display_name, bio, profile_image, profile_thumbnail, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * PUT /api/users/profile
 */
router.put('/', authenticateToken, (req, res) => {
  try {
    const { displayName, bio } = req.body;
    const userId = req.user.id;

    const updates = [];
    const values = [];

    if (displayName !== undefined) {
      updates.push('display_name = ?');
      values.push(displayName);
    }

    if (bio !== undefined) {
      updates.push('bio = ?');
      values.push(bio);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    if (updates.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    const user = db.prepare(`
      SELECT id, username, display_name, bio, profile_image, created_at
      FROM users WHERE id = ?
    `).get(userId);

    res.json({ user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * POST /api/users/profile/image
 */
router.post('/image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    let thumbnailUrl = null;

    try {
      const thumbnailFilename = `thumb-${req.file.filename}`;
      const thumbnailPath = path.join(__dirname, '..', '..', '..', 'uploads', thumbnailFilename);

      await sharp(req.file.path)
        .resize(64, 64, { fit: 'cover' })
        .png({ quality: 80 })
        .toFile(thumbnailPath);

      thumbnailUrl = `/uploads/${thumbnailFilename}`;
    } catch (thumbError) {
      console.warn('Failed to generate profile thumbnail:', thumbError.message);
    }

    db.prepare(`
      UPDATE users SET profile_image = ?, profile_thumbnail = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(imageUrl, thumbnailUrl, req.user.id);

    res.json({ imageUrl, thumbnailUrl });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

/**
 * DELETE /api/users/profile/image
 */
router.delete('/image', authenticateToken, (req, res) => {
  try {
    db.prepare(`
      UPDATE users SET profile_image = NULL, profile_thumbnail = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

/**
 * DELETE /api/users/profile/account
 */
router.delete('/account', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    // Delete in order to respect foreign key constraints
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

    const userConfigDir = path.join(__dirname, '..', '..', '..', 'config', 'users', String(userId));
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
