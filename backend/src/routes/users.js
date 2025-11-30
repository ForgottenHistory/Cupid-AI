import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';
import db from '../db/database.js';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for profile image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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
 * Get current user's profile
 */
router.get('/profile', authenticateToken, (req, res) => {
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
 * Update user profile
 */
router.put('/profile', authenticateToken, (req, res) => {
  try {
    const { displayName, bio } = req.body;
    const userId = req.user.id;

    // Build update query dynamically
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

    if (updates.length === 1) { // Only updated_at
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    // Get updated user
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
 * Upload profile image and generate thumbnail
 */
router.post('/profile/image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    let thumbnailUrl = null;

    // Generate thumbnail
    try {
      const thumbnailFilename = `thumb-${req.file.filename}`;
      const thumbnailPath = path.join(__dirname, '..', '..', 'uploads', thumbnailFilename);

      await sharp(req.file.path)
        .resize(64, 64, { fit: 'cover' })
        .png({ quality: 80 })
        .toFile(thumbnailPath);

      thumbnailUrl = `/uploads/${thumbnailFilename}`;
    } catch (thumbError) {
      console.warn('Failed to generate profile thumbnail:', thumbError.message);
    }

    // Update user's profile image and thumbnail
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
 * Remove profile image and thumbnail
 */
router.delete('/profile/image', authenticateToken, (req, res) => {
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
 * GET /api/users/llm-settings
 * Get user's LLM settings
 */
router.get('/llm-settings', authenticateToken, (req, res) => {
  try {
    const settings = db.prepare(`
      SELECT llm_provider, llm_model, llm_temperature, llm_max_tokens, llm_top_p,
             llm_frequency_penalty, llm_presence_penalty, llm_context_window,
             llm_top_k, llm_repetition_penalty, llm_min_p
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!settings) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      provider: settings.llm_provider || 'openrouter',
      model: settings.llm_model,
      temperature: settings.llm_temperature,
      maxTokens: settings.llm_max_tokens,
      topP: settings.llm_top_p,
      frequencyPenalty: settings.llm_frequency_penalty,
      presencePenalty: settings.llm_presence_penalty,
      contextWindow: settings.llm_context_window,
      topK: settings.llm_top_k,
      repetitionPenalty: settings.llm_repetition_penalty,
      minP: settings.llm_min_p
    });
  } catch (error) {
    console.error('Get LLM settings error:', error);
    res.status(500).json({ error: 'Failed to get LLM settings' });
  }
});

/**
 * PUT /api/users/llm-settings
 * Update user's LLM settings
 */
router.put('/llm-settings', authenticateToken, (req, res) => {
  try {
    const { provider, model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, contextWindow, topK, repetitionPenalty, minP } = req.body;
    const userId = req.user.id;

    // Validate parameters
    if (provider !== undefined && !['openrouter', 'featherless'].includes(provider)) {
      return res.status(400).json({ error: 'Provider must be either openrouter or featherless' });
    }
    if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
      return res.status(400).json({ error: 'Temperature must be between 0 and 2' });
    }
    if (maxTokens !== undefined && (maxTokens < 1 || maxTokens > 4000)) {
      return res.status(400).json({ error: 'Max tokens must be between 1 and 4000' });
    }
    if (topP !== undefined && (topP < 0 || topP > 1)) {
      return res.status(400).json({ error: 'Top P must be between 0 and 1' });
    }
    if (frequencyPenalty !== undefined && (frequencyPenalty < -2 || frequencyPenalty > 2)) {
      return res.status(400).json({ error: 'Frequency penalty must be between -2 and 2' });
    }
    if (presencePenalty !== undefined && (presencePenalty < -2 || presencePenalty > 2)) {
      return res.status(400).json({ error: 'Presence penalty must be between -2 and 2' });
    }
    if (contextWindow !== undefined && (contextWindow < 1000 || contextWindow > 200000)) {
      return res.status(400).json({ error: 'Context window must be between 1000 and 200000' });
    }

    // Featherless-specific parameter validation (only validate if provider is featherless)
    if (provider === 'featherless') {
      if (topK !== undefined && topK < -1) {
        return res.status(400).json({ error: 'Top K must be -1 or greater' });
      }
      if (repetitionPenalty !== undefined && (repetitionPenalty < 0 || repetitionPenalty > 2)) {
        return res.status(400).json({ error: 'Repetition penalty must be between 0 and 2' });
      }
      if (minP !== undefined && (minP < 0 || minP > 1)) {
        return res.status(400).json({ error: 'Min P must be between 0 and 1' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (provider !== undefined) {
      updates.push('llm_provider = ?');
      values.push(provider);
    }
    if (model !== undefined) {
      updates.push('llm_model = ?');
      values.push(model);
    }
    if (temperature !== undefined) {
      updates.push('llm_temperature = ?');
      values.push(temperature);
    }
    if (maxTokens !== undefined) {
      updates.push('llm_max_tokens = ?');
      values.push(maxTokens);
    }
    if (topP !== undefined) {
      updates.push('llm_top_p = ?');
      values.push(topP);
    }
    if (frequencyPenalty !== undefined) {
      updates.push('llm_frequency_penalty = ?');
      values.push(frequencyPenalty);
    }
    if (presencePenalty !== undefined) {
      updates.push('llm_presence_penalty = ?');
      values.push(presencePenalty);
    }
    if (contextWindow !== undefined) {
      updates.push('llm_context_window = ?');
      values.push(contextWindow);
    }
    if (topK !== undefined) {
      updates.push('llm_top_k = ?');
      values.push(topK);
    }
    if (repetitionPenalty !== undefined) {
      updates.push('llm_repetition_penalty = ?');
      values.push(repetitionPenalty);
    }
    if (minP !== undefined) {
      updates.push('llm_min_p = ?');
      values.push(minP);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    if (updates.length === 1) { // Only updated_at
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    // Get updated settings
    const settings = db.prepare(`
      SELECT llm_model, llm_temperature, llm_max_tokens, llm_top_p,
             llm_frequency_penalty, llm_presence_penalty, llm_context_window,
             llm_top_k, llm_repetition_penalty, llm_min_p
      FROM users WHERE id = ?
    `).get(userId);

    res.json({
      model: settings.llm_model,
      temperature: settings.llm_temperature,
      maxTokens: settings.llm_max_tokens,
      topP: settings.llm_top_p,
      frequencyPenalty: settings.llm_frequency_penalty,
      presencePenalty: settings.llm_presence_penalty,
      contextWindow: settings.llm_context_window,
      topK: settings.llm_top_k,
      repetitionPenalty: settings.llm_repetition_penalty,
      minP: settings.llm_min_p
    });
  } catch (error) {
    console.error('Update LLM settings error:', error);
    res.status(500).json({ error: 'Failed to update LLM settings' });
  }
});

/**
 * GET /api/users/decision-llm-settings
 * Get user's Decision LLM settings
 */
router.get('/decision-llm-settings', authenticateToken, (req, res) => {
  try {
    const settings = db.prepare(`
      SELECT decision_llm_provider, decision_llm_model, decision_llm_temperature, decision_llm_max_tokens, decision_llm_top_p,
             decision_llm_frequency_penalty, decision_llm_presence_penalty, decision_llm_context_window,
             decision_llm_top_k, decision_llm_repetition_penalty, decision_llm_min_p
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!settings) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      provider: settings.decision_llm_provider || 'openrouter',
      model: settings.decision_llm_model,
      temperature: settings.decision_llm_temperature,
      maxTokens: settings.decision_llm_max_tokens,
      topP: settings.decision_llm_top_p,
      frequencyPenalty: settings.decision_llm_frequency_penalty,
      presencePenalty: settings.decision_llm_presence_penalty,
      contextWindow: settings.decision_llm_context_window,
      topK: settings.decision_llm_top_k,
      repetitionPenalty: settings.decision_llm_repetition_penalty,
      minP: settings.decision_llm_min_p
    });
  } catch (error) {
    console.error('Get Decision LLM settings error:', error);
    res.status(500).json({ error: 'Failed to get Decision LLM settings' });
  }
});

/**
 * PUT /api/users/decision-llm-settings
 * Update user's Decision LLM settings
 */
router.put('/decision-llm-settings', authenticateToken, (req, res) => {
  try {
    const { provider, model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, contextWindow, topK, repetitionPenalty, minP } = req.body;
    const userId = req.user.id;

    // Validate parameters
    if (provider !== undefined && !['openrouter', 'featherless'].includes(provider)) {
      return res.status(400).json({ error: 'Provider must be either openrouter or featherless' });
    }
    if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
      return res.status(400).json({ error: 'Temperature must be between 0 and 2' });
    }
    if (maxTokens !== undefined && (maxTokens < 1 || maxTokens > 4000)) {
      return res.status(400).json({ error: 'Max tokens must be between 1 and 4000' });
    }
    if (topP !== undefined && (topP < 0 || topP > 1)) {
      return res.status(400).json({ error: 'Top P must be between 0 and 1' });
    }
    if (frequencyPenalty !== undefined && (frequencyPenalty < -2 || frequencyPenalty > 2)) {
      return res.status(400).json({ error: 'Frequency penalty must be between -2 and 2' });
    }
    if (presencePenalty !== undefined && (presencePenalty < -2 || presencePenalty > 2)) {
      return res.status(400).json({ error: 'Presence penalty must be between -2 and 2' });
    }
    if (contextWindow !== undefined && (contextWindow < 1000 || contextWindow > 200000)) {
      return res.status(400).json({ error: 'Context window must be between 1000 and 200000' });
    }

    // Featherless-specific parameter validation (only validate if provider is featherless)
    if (provider === 'featherless') {
      if (topK !== undefined && topK < -1) {
        return res.status(400).json({ error: 'Top K must be -1 or greater' });
      }
      if (repetitionPenalty !== undefined && (repetitionPenalty < 0 || repetitionPenalty > 2)) {
        return res.status(400).json({ error: 'Repetition penalty must be between 0 and 2' });
      }
      if (minP !== undefined && (minP < 0 || minP > 1)) {
        return res.status(400).json({ error: 'Min P must be between 0 and 1' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (provider !== undefined) {
      updates.push('decision_llm_provider = ?');
      values.push(provider);
    }
    if (model !== undefined) {
      updates.push('decision_llm_model = ?');
      values.push(model);
    }
    if (temperature !== undefined) {
      updates.push('decision_llm_temperature = ?');
      values.push(temperature);
    }
    if (maxTokens !== undefined) {
      updates.push('decision_llm_max_tokens = ?');
      values.push(maxTokens);
    }
    if (topP !== undefined) {
      updates.push('decision_llm_top_p = ?');
      values.push(topP);
    }
    if (frequencyPenalty !== undefined) {
      updates.push('decision_llm_frequency_penalty = ?');
      values.push(frequencyPenalty);
    }
    if (presencePenalty !== undefined) {
      updates.push('decision_llm_presence_penalty = ?');
      values.push(presencePenalty);
    }
    if (contextWindow !== undefined) {
      updates.push('decision_llm_context_window = ?');
      values.push(contextWindow);
    }
    if (topK !== undefined) {
      updates.push('decision_llm_top_k = ?');
      values.push(topK);
    }
    if (repetitionPenalty !== undefined) {
      updates.push('decision_llm_repetition_penalty = ?');
      values.push(repetitionPenalty);
    }
    if (minP !== undefined) {
      updates.push('decision_llm_min_p = ?');
      values.push(minP);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    if (updates.length === 1) { // Only updated_at
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    // Get updated settings
    const settings = db.prepare(`
      SELECT decision_llm_provider, decision_llm_model, decision_llm_temperature, decision_llm_max_tokens, decision_llm_top_p,
             decision_llm_frequency_penalty, decision_llm_presence_penalty, decision_llm_context_window,
             decision_llm_top_k, decision_llm_repetition_penalty, decision_llm_min_p
      FROM users WHERE id = ?
    `).get(userId);

    res.json({
      provider: settings.decision_llm_provider || 'openrouter',
      model: settings.decision_llm_model,
      temperature: settings.decision_llm_temperature,
      maxTokens: settings.decision_llm_max_tokens,
      topP: settings.decision_llm_top_p,
      frequencyPenalty: settings.decision_llm_frequency_penalty,
      presencePenalty: settings.decision_llm_presence_penalty,
      contextWindow: settings.decision_llm_context_window,
      topK: settings.decision_llm_top_k,
      repetitionPenalty: settings.decision_llm_repetition_penalty,
      minP: settings.decision_llm_min_p
    });
  } catch (error) {
    console.error('Update Decision LLM settings error:', error);
    res.status(500).json({ error: 'Failed to update Decision LLM settings' });
  }
});

/**
 * GET /api/users/imagetag-llm-settings
 * Get user's Image Tag LLM settings
 */
router.get('/imagetag-llm-settings', authenticateToken, (req, res) => {
  try {
    const settings = db.prepare(`
      SELECT imagetag_llm_provider, imagetag_llm_model, imagetag_llm_temperature, imagetag_llm_max_tokens, imagetag_llm_top_p,
             imagetag_llm_frequency_penalty, imagetag_llm_presence_penalty,
             imagetag_llm_top_k, imagetag_llm_repetition_penalty, imagetag_llm_min_p
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!settings) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      provider: settings.imagetag_llm_provider || 'openrouter',
      model: settings.imagetag_llm_model,
      temperature: settings.imagetag_llm_temperature,
      maxTokens: settings.imagetag_llm_max_tokens,
      topP: settings.imagetag_llm_top_p,
      frequencyPenalty: settings.imagetag_llm_frequency_penalty,
      presencePenalty: settings.imagetag_llm_presence_penalty,
      topK: settings.imagetag_llm_top_k,
      repetitionPenalty: settings.imagetag_llm_repetition_penalty,
      minP: settings.imagetag_llm_min_p
    });
  } catch (error) {
    console.error('Get Image Tag LLM settings error:', error);
    res.status(500).json({ error: 'Failed to get Image Tag LLM settings' });
  }
});

/**
 * PUT /api/users/imagetag-llm-settings
 * Update user's Image Tag LLM settings
 */
router.put('/imagetag-llm-settings', authenticateToken, (req, res) => {
  try {
    const { provider, model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, topK, repetitionPenalty, minP } = req.body;
    const userId = req.user.id;

    // Validate parameters
    if (provider !== undefined && !['openrouter', 'featherless'].includes(provider)) {
      return res.status(400).json({ error: 'Provider must be either openrouter or featherless' });
    }
    if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
      return res.status(400).json({ error: 'Temperature must be between 0 and 2' });
    }
    if (maxTokens !== undefined && (maxTokens < 1 || maxTokens > 4000)) {
      return res.status(400).json({ error: 'Max tokens must be between 1 and 4000' });
    }
    if (topP !== undefined && (topP < 0 || topP > 1)) {
      return res.status(400).json({ error: 'Top P must be between 0 and 1' });
    }
    if (frequencyPenalty !== undefined && (frequencyPenalty < -2 || frequencyPenalty > 2)) {
      return res.status(400).json({ error: 'Frequency penalty must be between -2 and 2' });
    }
    if (presencePenalty !== undefined && (presencePenalty < -2 || presencePenalty > 2)) {
      return res.status(400).json({ error: 'Presence penalty must be between -2 and 2' });
    }

    // Featherless-specific parameter validation (only validate if provider is featherless)
    if (provider === 'featherless') {
      if (topK !== undefined && topK < -1) {
        return res.status(400).json({ error: 'Top K must be -1 or greater' });
      }
      if (repetitionPenalty !== undefined && (repetitionPenalty < 0 || repetitionPenalty > 2)) {
        return res.status(400).json({ error: 'Repetition penalty must be between 0 and 2' });
      }
      if (minP !== undefined && (minP < 0 || minP > 1)) {
        return res.status(400).json({ error: 'Min P must be between 0 and 1' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (provider !== undefined) {
      updates.push('imagetag_llm_provider = ?');
      values.push(provider);
    }
    if (model !== undefined) {
      updates.push('imagetag_llm_model = ?');
      values.push(model);
    }
    if (temperature !== undefined) {
      updates.push('imagetag_llm_temperature = ?');
      values.push(temperature);
    }
    if (maxTokens !== undefined) {
      updates.push('imagetag_llm_max_tokens = ?');
      values.push(maxTokens);
    }
    if (topP !== undefined) {
      updates.push('imagetag_llm_top_p = ?');
      values.push(topP);
    }
    if (frequencyPenalty !== undefined) {
      updates.push('imagetag_llm_frequency_penalty = ?');
      values.push(frequencyPenalty);
    }
    if (presencePenalty !== undefined) {
      updates.push('imagetag_llm_presence_penalty = ?');
      values.push(presencePenalty);
    }
    if (topK !== undefined) {
      updates.push('imagetag_llm_top_k = ?');
      values.push(topK);
    }
    if (repetitionPenalty !== undefined) {
      updates.push('imagetag_llm_repetition_penalty = ?');
      values.push(repetitionPenalty);
    }
    if (minP !== undefined) {
      updates.push('imagetag_llm_min_p = ?');
      values.push(minP);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    if (updates.length === 1) { // Only updated_at
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    // Get updated settings
    const settings = db.prepare(`
      SELECT imagetag_llm_provider, imagetag_llm_model, imagetag_llm_temperature, imagetag_llm_max_tokens, imagetag_llm_top_p,
             imagetag_llm_frequency_penalty, imagetag_llm_presence_penalty,
             imagetag_llm_top_k, imagetag_llm_repetition_penalty, imagetag_llm_min_p
      FROM users WHERE id = ?
    `).get(userId);

    res.json({
      provider: settings.imagetag_llm_provider || 'openrouter',
      model: settings.imagetag_llm_model,
      temperature: settings.imagetag_llm_temperature,
      maxTokens: settings.imagetag_llm_max_tokens,
      topP: settings.imagetag_llm_top_p,
      frequencyPenalty: settings.imagetag_llm_frequency_penalty,
      presencePenalty: settings.imagetag_llm_presence_penalty,
      topK: settings.imagetag_llm_top_k,
      repetitionPenalty: settings.imagetag_llm_repetition_penalty,
      minP: settings.imagetag_llm_min_p
    });
  } catch (error) {
    console.error('Update Image Tag LLM settings error:', error);
    res.status(500).json({ error: 'Failed to update Image Tag LLM settings' });
  }
});

/**
 * GET /api/users/metadata-llm-settings
 * Get user's Metadata LLM settings
 */
router.get('/metadata-llm-settings', authenticateToken, (req, res) => {
  try {
    const settings = db.prepare(`
      SELECT metadata_llm_provider, metadata_llm_model, metadata_llm_temperature, metadata_llm_max_tokens, metadata_llm_top_p,
             metadata_llm_frequency_penalty, metadata_llm_presence_penalty, metadata_llm_context_window,
             metadata_llm_top_k, metadata_llm_repetition_penalty, metadata_llm_min_p
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!settings) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      provider: settings.metadata_llm_provider || 'openrouter',
      model: settings.metadata_llm_model,
      temperature: settings.metadata_llm_temperature,
      maxTokens: settings.metadata_llm_max_tokens,
      topP: settings.metadata_llm_top_p,
      frequencyPenalty: settings.metadata_llm_frequency_penalty,
      presencePenalty: settings.metadata_llm_presence_penalty,
      contextWindow: settings.metadata_llm_context_window,
      topK: settings.metadata_llm_top_k,
      repetitionPenalty: settings.metadata_llm_repetition_penalty,
      minP: settings.metadata_llm_min_p
    });
  } catch (error) {
    console.error('Get Metadata LLM settings error:', error);
    res.status(500).json({ error: 'Failed to get Metadata LLM settings' });
  }
});

/**
 * PUT /api/users/metadata-llm-settings
 * Update user's Metadata LLM settings
 */
router.put('/metadata-llm-settings', authenticateToken, (req, res) => {
  try {
    const { provider, model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, contextWindow, topK, repetitionPenalty, minP } = req.body;
    const userId = req.user.id;

    // Validate parameters
    if (provider !== undefined && !['openrouter', 'featherless'].includes(provider)) {
      return res.status(400).json({ error: 'Provider must be either openrouter or featherless' });
    }
    if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
      return res.status(400).json({ error: 'Temperature must be between 0 and 2' });
    }
    if (maxTokens !== undefined && (maxTokens < 1 || maxTokens > 16000)) {
      return res.status(400).json({ error: 'Max tokens must be between 1 and 16000' });
    }
    if (topP !== undefined && (topP < 0 || topP > 1)) {
      return res.status(400).json({ error: 'Top P must be between 0 and 1' });
    }
    if (frequencyPenalty !== undefined && (frequencyPenalty < -2 || frequencyPenalty > 2)) {
      return res.status(400).json({ error: 'Frequency penalty must be between -2 and 2' });
    }
    if (presencePenalty !== undefined && (presencePenalty < -2 || presencePenalty > 2)) {
      return res.status(400).json({ error: 'Presence penalty must be between -2 and 2' });
    }
    if (contextWindow !== undefined && (contextWindow < 1 || contextWindow > 32000)) {
      return res.status(400).json({ error: 'Context window must be between 1 and 32000' });
    }

    // Featherless-specific parameter validation (only validate if provider is featherless)
    if (provider === 'featherless') {
      if (topK !== undefined && topK < -1) {
        return res.status(400).json({ error: 'Top K must be -1 or greater' });
      }
      if (repetitionPenalty !== undefined && (repetitionPenalty < 0 || repetitionPenalty > 2)) {
        return res.status(400).json({ error: 'Repetition penalty must be between 0 and 2' });
      }
      if (minP !== undefined && (minP < 0 || minP > 1)) {
        return res.status(400).json({ error: 'Min P must be between 0 and 1' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (provider !== undefined) {
      updates.push('metadata_llm_provider = ?');
      values.push(provider);
    }
    if (model !== undefined) {
      updates.push('metadata_llm_model = ?');
      values.push(model);
    }
    if (temperature !== undefined) {
      updates.push('metadata_llm_temperature = ?');
      values.push(temperature);
    }
    if (maxTokens !== undefined) {
      updates.push('metadata_llm_max_tokens = ?');
      values.push(maxTokens);
    }
    if (topP !== undefined) {
      updates.push('metadata_llm_top_p = ?');
      values.push(topP);
    }
    if (frequencyPenalty !== undefined) {
      updates.push('metadata_llm_frequency_penalty = ?');
      values.push(frequencyPenalty);
    }
    if (presencePenalty !== undefined) {
      updates.push('metadata_llm_presence_penalty = ?');
      values.push(presencePenalty);
    }
    if (contextWindow !== undefined) {
      updates.push('metadata_llm_context_window = ?');
      values.push(contextWindow);
    }
    if (topK !== undefined) {
      updates.push('metadata_llm_top_k = ?');
      values.push(topK);
    }
    if (repetitionPenalty !== undefined) {
      updates.push('metadata_llm_repetition_penalty = ?');
      values.push(repetitionPenalty);
    }
    if (minP !== undefined) {
      updates.push('metadata_llm_min_p = ?');
      values.push(minP);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    if (updates.length === 1) { // Only updated_at
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    // Get updated settings
    const settings = db.prepare(`
      SELECT metadata_llm_provider, metadata_llm_model, metadata_llm_temperature, metadata_llm_max_tokens, metadata_llm_top_p,
             metadata_llm_frequency_penalty, metadata_llm_presence_penalty, metadata_llm_context_window,
             metadata_llm_top_k, metadata_llm_repetition_penalty, metadata_llm_min_p
      FROM users WHERE id = ?
    `).get(userId);

    res.json({
      provider: settings.metadata_llm_provider || 'openrouter',
      model: settings.metadata_llm_model,
      temperature: settings.metadata_llm_temperature,
      maxTokens: settings.metadata_llm_max_tokens,
      topP: settings.metadata_llm_top_p,
      frequencyPenalty: settings.metadata_llm_frequency_penalty,
      presencePenalty: settings.metadata_llm_presence_penalty,
      contextWindow: settings.metadata_llm_context_window,
      topK: settings.metadata_llm_top_k,
      repetitionPenalty: settings.metadata_llm_repetition_penalty,
      minP: settings.metadata_llm_min_p
    });
  } catch (error) {
    console.error('Update Metadata LLM settings error:', error);
    res.status(500).json({ error: 'Failed to update Metadata LLM settings' });
  }
});

/**
 * GET /api/users/sd-settings
 * Get user's Stable Diffusion settings
 */
router.get('/sd-settings', authenticateToken, (req, res) => {
  try {
    const settings = db.prepare(`
      SELECT sd_steps, sd_cfg_scale, sd_sampler, sd_scheduler,
             sd_enable_hr, sd_hr_scale, sd_hr_upscaler, sd_hr_steps,
             sd_hr_cfg, sd_denoising_strength, sd_enable_adetailer, sd_adetailer_model,
             sd_main_prompt, sd_negative_prompt, sd_model
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!settings) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      sd_steps: settings.sd_steps,
      sd_cfg_scale: settings.sd_cfg_scale,
      sd_sampler: settings.sd_sampler,
      sd_scheduler: settings.sd_scheduler,
      sd_enable_hr: Boolean(settings.sd_enable_hr),
      sd_hr_scale: settings.sd_hr_scale,
      sd_hr_upscaler: settings.sd_hr_upscaler,
      sd_hr_steps: settings.sd_hr_steps,
      sd_hr_cfg: settings.sd_hr_cfg,
      sd_denoising_strength: settings.sd_denoising_strength,
      sd_enable_adetailer: Boolean(settings.sd_enable_adetailer),
      sd_adetailer_model: settings.sd_adetailer_model,
      sd_main_prompt: settings.sd_main_prompt || 'masterpiece, best quality, amazing quality',
      sd_negative_prompt: settings.sd_negative_prompt || 'nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry',
      sd_model: settings.sd_model || ''
    });
  } catch (error) {
    console.error('Get SD settings error:', error);
    res.status(500).json({ error: 'Failed to get SD settings' });
  }
});

/**
 * PUT /api/users/sd-settings
 * Update user's Stable Diffusion settings
 */
router.put('/sd-settings', authenticateToken, (req, res) => {
  try {
    const {
      sd_steps, sd_cfg_scale, sd_sampler, sd_scheduler,
      sd_enable_hr, sd_hr_scale, sd_hr_upscaler, sd_hr_steps,
      sd_hr_cfg, sd_denoising_strength, sd_enable_adetailer, sd_adetailer_model,
      sd_main_prompt, sd_negative_prompt, sd_model
    } = req.body;
    const userId = req.user.id;

    db.prepare(`
      UPDATE users
      SET sd_steps = ?, sd_cfg_scale = ?, sd_sampler = ?, sd_scheduler = ?,
          sd_enable_hr = ?, sd_hr_scale = ?, sd_hr_upscaler = ?, sd_hr_steps = ?,
          sd_hr_cfg = ?, sd_denoising_strength = ?, sd_enable_adetailer = ?, sd_adetailer_model = ?,
          sd_main_prompt = ?, sd_negative_prompt = ?, sd_model = ?
      WHERE id = ?
    `).run(
      sd_steps, sd_cfg_scale, sd_sampler, sd_scheduler,
      sd_enable_hr ? 1 : 0, sd_hr_scale, sd_hr_upscaler, sd_hr_steps,
      sd_hr_cfg, sd_denoising_strength, sd_enable_adetailer ? 1 : 0, sd_adetailer_model,
      sd_main_prompt, sd_negative_prompt, sd_model,
      userId
    );

    res.json({ success: true, message: 'SD settings updated successfully' });
  } catch (error) {
    console.error('Update SD settings error:', error);
    res.status(500).json({ error: 'Failed to update SD settings' });
  }
});

/**
 * GET /api/users/behavior-settings
 * Get user's behavior settings
 */
router.get('/behavior-settings', authenticateToken, (req, res) => {
  try {
    const settings = db.prepare(`
      SELECT proactive_message_hours, daily_proactive_limit,
             proactive_away_chance, proactive_busy_chance, pacing_style, proactive_check_interval,
             max_consecutive_proactive, proactive_cooldown_multiplier,
             compact_threshold_percent, compact_target_percent, keep_uncompacted_messages,
             auto_unmatch_inactive_days, auto_unmatch_after_proactive, daily_swipe_limit, daily_auto_match_enabled,
             compaction_enabled, max_memories, max_matches, thought_frequency,
             memory_degradation_points
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!settings) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      proactiveMessageHours: settings.proactive_message_hours,
      dailyProactiveLimit: settings.daily_proactive_limit,
      proactiveAwayChance: settings.proactive_away_chance,
      proactiveBusyChance: settings.proactive_busy_chance,
      pacingStyle: settings.pacing_style,
      proactiveCheckInterval: settings.proactive_check_interval,
      maxConsecutiveProactive: settings.max_consecutive_proactive,
      proactiveCooldownMultiplier: settings.proactive_cooldown_multiplier,
      compactThresholdPercent: settings.compact_threshold_percent,
      compactTargetPercent: settings.compact_target_percent,
      keepUncompactedMessages: settings.keep_uncompacted_messages,
      autoUnmatchInactiveDays: settings.auto_unmatch_inactive_days,
      autoUnmatchAfterProactive: Boolean(settings.auto_unmatch_after_proactive),
      dailySwipeLimit: settings.daily_swipe_limit,
      dailyAutoMatchEnabled: Boolean(settings.daily_auto_match_enabled),
      compactionEnabled: Boolean(settings.compaction_enabled),
      maxMemories: settings.max_memories,
      maxMatches: settings.max_matches,
      thoughtFrequency: settings.thought_frequency,
      memoryDegradationPoints: settings.memory_degradation_points
    });
  } catch (error) {
    console.error('Get behavior settings error:', error);
    res.status(500).json({ error: 'Failed to get behavior settings' });
  }
});

/**
 * PUT /api/users/behavior-settings
 * Update user's behavior settings
 */
router.put('/behavior-settings', authenticateToken, (req, res) => {
  try {
    const { proactiveMessageHours, dailyProactiveLimit, proactiveAwayChance, proactiveBusyChance, pacingStyle, proactiveCheckInterval, maxConsecutiveProactive, proactiveCooldownMultiplier, compactThresholdPercent, compactTargetPercent, keepUncompactedMessages, autoUnmatchInactiveDays, autoUnmatchAfterProactive, dailySwipeLimit, dailyAutoMatchEnabled, compactionEnabled, maxMemories, maxMatches, thoughtFrequency, memoryDegradationPoints } = req.body;
    const userId = req.user.id;

    // Validate parameters
    if (proactiveMessageHours !== undefined && (proactiveMessageHours < 1 || proactiveMessageHours > 24)) {
      return res.status(400).json({ error: 'Proactive message hours must be between 1 and 24' });
    }
    if (dailyProactiveLimit !== undefined && (dailyProactiveLimit < 1 || dailyProactiveLimit > 20)) {
      return res.status(400).json({ error: 'Daily proactive limit must be between 1 and 20' });
    }
    if (proactiveAwayChance !== undefined && (proactiveAwayChance < 0 || proactiveAwayChance > 100)) {
      return res.status(400).json({ error: 'Proactive away chance must be between 0 and 100' });
    }
    if (proactiveBusyChance !== undefined && (proactiveBusyChance < 0 || proactiveBusyChance > 100)) {
      return res.status(400).json({ error: 'Proactive busy chance must be between 0 and 100' });
    }
    if (pacingStyle !== undefined && !['slow', 'balanced', 'forward'].includes(pacingStyle)) {
      return res.status(400).json({ error: 'Pacing style must be slow, balanced, or forward' });
    }
    if (proactiveCheckInterval !== undefined && (proactiveCheckInterval < 5 || proactiveCheckInterval > 300)) {
      return res.status(400).json({ error: 'Proactive check interval must be between 5 and 300 minutes' });
    }
    if (maxConsecutiveProactive !== undefined && (maxConsecutiveProactive < 0 || maxConsecutiveProactive > 10)) {
      return res.status(400).json({ error: 'Max consecutive proactive must be between 0 and 10' });
    }
    if (proactiveCooldownMultiplier !== undefined && (proactiveCooldownMultiplier < 1.0 || proactiveCooldownMultiplier > 5.0)) {
      return res.status(400).json({ error: 'Proactive cooldown multiplier must be between 1.0 and 5.0' });
    }
    if (compactThresholdPercent !== undefined && (compactThresholdPercent < 50 || compactThresholdPercent > 100)) {
      return res.status(400).json({ error: 'Compact threshold must be between 50 and 100 percent' });
    }
    if (compactTargetPercent !== undefined && (compactTargetPercent < 30 || compactTargetPercent > 90)) {
      return res.status(400).json({ error: 'Compact target must be between 30 and 90 percent' });
    }
    if (keepUncompactedMessages !== undefined && (keepUncompactedMessages < 10 || keepUncompactedMessages > 100)) {
      return res.status(400).json({ error: 'Keep uncompacted messages must be between 10 and 100' });
    }
    if (autoUnmatchInactiveDays !== undefined && (autoUnmatchInactiveDays < 0 || autoUnmatchInactiveDays > 90)) {
      return res.status(400).json({ error: 'Auto-unmatch inactive days must be between 0 and 90' });
    }
    if (autoUnmatchAfterProactive !== undefined && typeof autoUnmatchAfterProactive !== 'boolean') {
      return res.status(400).json({ error: 'Auto-unmatch after proactive must be a boolean' });
    }
    if (dailySwipeLimit !== undefined && (dailySwipeLimit < 0 || dailySwipeLimit > 10)) {
      return res.status(400).json({ error: 'Daily swipe limit must be between 0 and 10' });
    }
    if (maxMemories !== undefined && (maxMemories < 0 || maxMemories > 100)) {
      return res.status(400).json({ error: 'Max memories must be between 0 and 100' });
    }
    if (maxMatches !== undefined && (maxMatches < 0 || maxMatches > 50)) {
      return res.status(400).json({ error: 'Max matches must be between 0 and 50' });
    }
    if (thoughtFrequency !== undefined && (thoughtFrequency < 0 || thoughtFrequency > 25)) {
      return res.status(400).json({ error: 'Thought frequency must be between 0 and 25' });
    }
    if (memoryDegradationPoints !== undefined && (memoryDegradationPoints < 0 || memoryDegradationPoints > 100)) {
      return res.status(400).json({ error: 'Memory degradation points must be between 0 and 100' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (proactiveMessageHours !== undefined) {
      updates.push('proactive_message_hours = ?');
      values.push(proactiveMessageHours);
    }
    if (dailyProactiveLimit !== undefined) {
      updates.push('daily_proactive_limit = ?');
      values.push(dailyProactiveLimit);
    }
    if (proactiveAwayChance !== undefined) {
      updates.push('proactive_away_chance = ?');
      values.push(proactiveAwayChance);
    }
    if (proactiveBusyChance !== undefined) {
      updates.push('proactive_busy_chance = ?');
      values.push(proactiveBusyChance);
    }
    if (pacingStyle !== undefined) {
      updates.push('pacing_style = ?');
      values.push(pacingStyle);
    }
    if (proactiveCheckInterval !== undefined) {
      updates.push('proactive_check_interval = ?');
      values.push(proactiveCheckInterval);
    }
    if (maxConsecutiveProactive !== undefined) {
      updates.push('max_consecutive_proactive = ?');
      values.push(maxConsecutiveProactive);
    }
    if (proactiveCooldownMultiplier !== undefined) {
      updates.push('proactive_cooldown_multiplier = ?');
      values.push(proactiveCooldownMultiplier);
    }
    if (compactThresholdPercent !== undefined) {
      updates.push('compact_threshold_percent = ?');
      values.push(compactThresholdPercent);
    }
    if (compactTargetPercent !== undefined) {
      updates.push('compact_target_percent = ?');
      values.push(compactTargetPercent);
    }
    if (keepUncompactedMessages !== undefined) {
      updates.push('keep_uncompacted_messages = ?');
      values.push(keepUncompactedMessages);
    }
    if (autoUnmatchInactiveDays !== undefined) {
      updates.push('auto_unmatch_inactive_days = ?');
      values.push(autoUnmatchInactiveDays);
    }
    if (autoUnmatchAfterProactive !== undefined) {
      updates.push('auto_unmatch_after_proactive = ?');
      values.push(autoUnmatchAfterProactive ? 1 : 0);
    }
    if (dailySwipeLimit !== undefined) {
      updates.push('daily_swipe_limit = ?');
      values.push(dailySwipeLimit);
    }
    if (dailyAutoMatchEnabled !== undefined) {
      updates.push('daily_auto_match_enabled = ?');
      values.push(dailyAutoMatchEnabled ? 1 : 0);
    }
    if (compactionEnabled !== undefined) {
      updates.push('compaction_enabled = ?');
      values.push(compactionEnabled ? 1 : 0);
    }
    if (maxMemories !== undefined) {
      updates.push('max_memories = ?');
      values.push(maxMemories);
    }
    if (maxMatches !== undefined) {
      updates.push('max_matches = ?');
      values.push(maxMatches);
    }
    if (thoughtFrequency !== undefined) {
      updates.push('thought_frequency = ?');
      values.push(thoughtFrequency);
    }
    if (memoryDegradationPoints !== undefined) {
      updates.push('memory_degradation_points = ?');
      values.push(memoryDegradationPoints);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    if (updates.length === 1) { // Only updated_at
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    // Get updated settings
    const settings = db.prepare(`
      SELECT proactive_message_hours, daily_proactive_limit,
             proactive_away_chance, proactive_busy_chance, pacing_style, proactive_check_interval,
             max_consecutive_proactive, proactive_cooldown_multiplier,
             compact_threshold_percent, compact_target_percent, keep_uncompacted_messages,
             auto_unmatch_inactive_days, auto_unmatch_after_proactive, daily_swipe_limit, daily_auto_match_enabled,
             compaction_enabled, max_memories, max_matches, thought_frequency,
             memory_degradation_points
      FROM users WHERE id = ?
    `).get(userId);

    res.json({
      proactiveMessageHours: settings.proactive_message_hours,
      dailyProactiveLimit: settings.daily_proactive_limit,
      proactiveAwayChance: settings.proactive_away_chance,
      proactiveBusyChance: settings.proactive_busy_chance,
      pacingStyle: settings.pacing_style,
      proactiveCheckInterval: settings.proactive_check_interval,
      maxConsecutiveProactive: settings.max_consecutive_proactive,
      proactiveCooldownMultiplier: settings.proactive_cooldown_multiplier,
      compactThresholdPercent: settings.compact_threshold_percent,
      compactTargetPercent: settings.compact_target_percent,
      keepUncompactedMessages: settings.keep_uncompacted_messages,
      autoUnmatchInactiveDays: settings.auto_unmatch_inactive_days,
      autoUnmatchAfterProactive: Boolean(settings.auto_unmatch_after_proactive),
      dailySwipeLimit: settings.daily_swipe_limit,
      dailyAutoMatchEnabled: Boolean(settings.daily_auto_match_enabled),
      compactionEnabled: Boolean(settings.compaction_enabled),
      maxMemories: settings.max_memories,
      maxMatches: settings.max_matches,
      thoughtFrequency: settings.thought_frequency,
      memoryDegradationPoints: settings.memory_degradation_points
    });
  } catch (error) {
    console.error('Update behavior settings error:', error);
    res.status(500).json({ error: 'Failed to update behavior settings' });
  }
});

export default router;
