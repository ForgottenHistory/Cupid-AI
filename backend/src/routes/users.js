import express from 'express';
import multer from 'multer';
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
      SELECT id, username, email, display_name, bio, profile_image, created_at
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
      SELECT id, username, email, display_name, bio, profile_image, created_at
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
 * Upload profile image
 */
router.post('/profile/image', authenticateToken, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    // Update user's profile image
    db.prepare(`
      UPDATE users SET profile_image = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(imageUrl, req.user.id);

    res.json({ imageUrl });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

/**
 * DELETE /api/users/profile/image
 * Remove profile image
 */
router.delete('/profile/image', authenticateToken, (req, res) => {
  try {
    db.prepare(`
      UPDATE users SET profile_image = NULL, updated_at = CURRENT_TIMESTAMP
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
      SELECT llm_model, llm_temperature, llm_max_tokens, llm_top_p,
             llm_frequency_penalty, llm_presence_penalty, llm_context_window
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!settings) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      model: settings.llm_model,
      temperature: settings.llm_temperature,
      maxTokens: settings.llm_max_tokens,
      topP: settings.llm_top_p,
      frequencyPenalty: settings.llm_frequency_penalty,
      presencePenalty: settings.llm_presence_penalty,
      contextWindow: settings.llm_context_window
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
    const { model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, contextWindow } = req.body;
    const userId = req.user.id;

    // Validate parameters
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

    // Build update query dynamically
    const updates = [];
    const values = [];

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
             llm_frequency_penalty, llm_presence_penalty, llm_context_window
      FROM users WHERE id = ?
    `).get(userId);

    res.json({
      model: settings.llm_model,
      temperature: settings.llm_temperature,
      maxTokens: settings.llm_max_tokens,
      topP: settings.llm_top_p,
      frequencyPenalty: settings.llm_frequency_penalty,
      presencePenalty: settings.llm_presence_penalty,
      contextWindow: settings.llm_context_window
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
      SELECT decision_llm_model, decision_llm_temperature, decision_llm_max_tokens, decision_llm_top_p,
             decision_llm_frequency_penalty, decision_llm_presence_penalty, decision_llm_context_window
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!settings) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      model: settings.decision_llm_model,
      temperature: settings.decision_llm_temperature,
      maxTokens: settings.decision_llm_max_tokens,
      topP: settings.decision_llm_top_p,
      frequencyPenalty: settings.decision_llm_frequency_penalty,
      presencePenalty: settings.decision_llm_presence_penalty,
      contextWindow: settings.decision_llm_context_window
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
    const { model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, contextWindow } = req.body;
    const userId = req.user.id;

    // Validate parameters
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

    // Build update query dynamically
    const updates = [];
    const values = [];

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

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    if (updates.length === 1) { // Only updated_at
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    // Get updated settings
    const settings = db.prepare(`
      SELECT decision_llm_model, decision_llm_temperature, decision_llm_max_tokens, decision_llm_top_p,
             decision_llm_frequency_penalty, decision_llm_presence_penalty, decision_llm_context_window
      FROM users WHERE id = ?
    `).get(userId);

    res.json({
      model: settings.decision_llm_model,
      temperature: settings.decision_llm_temperature,
      maxTokens: settings.decision_llm_max_tokens,
      topP: settings.decision_llm_top_p,
      frequencyPenalty: settings.decision_llm_frequency_penalty,
      presencePenalty: settings.decision_llm_presence_penalty,
      contextWindow: settings.decision_llm_context_window
    });
  } catch (error) {
    console.error('Update Decision LLM settings error:', error);
    res.status(500).json({ error: 'Failed to update Decision LLM settings' });
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

export default router;
