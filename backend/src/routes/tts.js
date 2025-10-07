import express from 'express';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ChatterBox TTS server URL
const TTS_SERVER_URL = process.env.TTS_SERVER_URL || 'http://localhost:5000';

// Configure multer for voice file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/flac'];
    const allowedExtensions = ['.wav', '.mp3', '.ogg', '.flac'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only WAV, MP3, OGG, and FLAC files are allowed.'));
    }
  }
});

// Create audio directory if it doesn't exist
const audioDir = path.join(__dirname, '..', '..', 'uploads', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

/**
 * GET /api/tts/voices
 * List all available voices
 */
router.get('/voices', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${TTS_SERVER_URL}/voices`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching voices:', error.message);
    res.status(500).json({
      error: 'Failed to fetch voices',
      details: error.message
    });
  }
});

/**
 * POST /api/tts/upload-voice
 * Upload a voice sample to ChatterBox server
 */
router.post('/upload-voice', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { voice_name } = req.body;

    if (!voice_name) {
      return res.status(400).json({ error: 'voice_name is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Create form data to send to ChatterBox server
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    formData.append('voice_name', voice_name);

    // Forward to ChatterBox server
    const response = await axios.post(`${TTS_SERVER_URL}/upload-voice`, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error uploading voice:', error.message);
    res.status(500).json({
      error: 'Failed to upload voice',
      details: error.response?.data || error.message
    });
  }
});

/**
 * DELETE /api/tts/voices/:voiceName
 * Delete a voice sample
 */
router.delete('/voices/:voiceName', authenticateToken, async (req, res) => {
  try {
    const { voiceName } = req.params;

    // Forward to ChatterBox server
    const response = await axios.delete(`${TTS_SERVER_URL}/voices/${voiceName}`);

    res.json(response.data);
  } catch (error) {
    console.error('Error deleting voice:', error.message);

    if (error.response?.status === 404) {
      return res.status(404).json({
        error: 'Voice not found',
        details: error.response.data
      });
    }

    res.status(500).json({
      error: 'Failed to delete voice',
      details: error.response?.data || error.message
    });
  }
});

/**
 * POST /api/tts/generate
 * Generate TTS audio and return file URL
 */
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { text, voice_name, exaggeration = 0.2, cfg_weight = 0.8 } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    // Create form data to send to ChatterBox server
    const formData = new FormData();
    formData.append('text', text);
    if (voice_name) {
      formData.append('voice_name', voice_name);
    }
    formData.append('exaggeration', String(exaggeration));
    formData.append('cfg_weight', String(cfg_weight));

    // Request audio from ChatterBox server
    const response = await axios.post(`${TTS_SERVER_URL}/generate`, formData, {
      headers: {
        ...formData.getHeaders()
      },
      responseType: 'arraybuffer'
    });

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `tts_${timestamp}_${Math.random().toString(36).substring(7)}.wav`;
    const filepath = path.join(audioDir, filename);

    // Save audio file
    fs.writeFileSync(filepath, response.data);

    // Return URL to access the file
    const audioUrl = `/uploads/audio/${filename}`;

    res.json({
      success: true,
      audio_url: audioUrl,
      text: text,
      voice_name: voice_name || null
    });
  } catch (error) {
    console.error('Error generating TTS:', error.message);
    res.status(500).json({
      error: 'Failed to generate TTS',
      details: error.response?.data || error.message
    });
  }
});

/**
 * GET /api/tts/health
 * Check if ChatterBox TTS server is running
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${TTS_SERVER_URL}/`);
    res.json({
      backend_status: 'ok',
      tts_server_status: response.data
    });
  } catch (error) {
    console.error('TTS server health check failed:', error.message);
    res.status(503).json({
      backend_status: 'ok',
      tts_server_status: 'unavailable',
      error: error.message
    });
  }
});

export default router;
