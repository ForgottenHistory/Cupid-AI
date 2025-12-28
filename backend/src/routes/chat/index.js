import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authenticateToken } from '../../middleware/auth.js';

import conversationsRouter from './conversations.js';
import messagesRouter from './messages.js';
import generationRouter from './generation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for user image uploads
const userImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads', 'user_images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `user_${req.user.id}_${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const uploadUserImage = multer({
  storage: userImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Mount sub-routers
router.use('/conversations', conversationsRouter);
router.use('/messages', messagesRouter);

// Generation routes have mixed paths, so we mount at root and include full paths
router.use('/', generationRouter);

/**
 * POST /api/chat/upload-user-image
 * Upload a user image for sending in chat
 */
router.post('/upload-user-image', authenticateToken, uploadUserImage.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageUrl = `/uploads/user_images/${req.file.filename}`;
    console.log(`✅ User image uploaded: ${imageUrl}`);

    res.json({ imageUrl });
  } catch (error) {
    console.error('Upload user image error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload image' });
  }
});

export default router;
