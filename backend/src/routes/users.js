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
      SELECT llm_provider, llm_model, llm_temperature, llm_max_tokens, llm_top_p,
             llm_frequency_penalty, llm_presence_penalty, llm_context_window
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
    const { provider, model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, contextWindow } = req.body;
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
      SELECT decision_llm_provider, decision_llm_model, decision_llm_temperature, decision_llm_max_tokens, decision_llm_top_p,
             decision_llm_frequency_penalty, decision_llm_presence_penalty, decision_llm_context_window
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
    const { provider, model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, contextWindow } = req.body;
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
             decision_llm_frequency_penalty, decision_llm_presence_penalty, decision_llm_context_window
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
      contextWindow: settings.decision_llm_context_window
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
             imagetag_llm_frequency_penalty, imagetag_llm_presence_penalty
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
      presencePenalty: settings.imagetag_llm_presence_penalty
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
    const { provider, model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty } = req.body;
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
             imagetag_llm_frequency_penalty, imagetag_llm_presence_penalty
      FROM users WHERE id = ?
    `).get(userId);

    res.json({
      provider: settings.imagetag_llm_provider || 'openrouter',
      model: settings.imagetag_llm_model,
      temperature: settings.imagetag_llm_temperature,
      maxTokens: settings.imagetag_llm_max_tokens,
      topP: settings.imagetag_llm_top_p,
      frequencyPenalty: settings.imagetag_llm_frequency_penalty,
      presencePenalty: settings.imagetag_llm_presence_penalty
    });
  } catch (error) {
    console.error('Update Image Tag LLM settings error:', error);
    res.status(500).json({ error: 'Failed to update Image Tag LLM settings' });
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
      SELECT max_emojis_per_message, proactive_message_hours, daily_proactive_limit,
             proactive_away_chance, proactive_busy_chance, pacing_style, proactive_check_interval,
             max_consecutive_proactive, proactive_cooldown_multiplier,
             daily_left_on_read_limit, left_on_read_trigger_min, left_on_read_trigger_max, left_on_read_character_cooldown,
             compact_threshold_percent, compact_target_percent, keep_uncompacted_messages
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!settings) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      maxEmojisPerMessage: settings.max_emojis_per_message,
      proactiveMessageHours: settings.proactive_message_hours,
      dailyProactiveLimit: settings.daily_proactive_limit,
      proactiveAwayChance: settings.proactive_away_chance,
      proactiveBusyChance: settings.proactive_busy_chance,
      pacingStyle: settings.pacing_style,
      proactiveCheckInterval: settings.proactive_check_interval,
      maxConsecutiveProactive: settings.max_consecutive_proactive,
      proactiveCooldownMultiplier: settings.proactive_cooldown_multiplier,
      dailyLeftOnReadLimit: settings.daily_left_on_read_limit,
      leftOnReadTriggerMin: settings.left_on_read_trigger_min,
      leftOnReadTriggerMax: settings.left_on_read_trigger_max,
      leftOnReadCharacterCooldown: settings.left_on_read_character_cooldown,
      compactThresholdPercent: settings.compact_threshold_percent,
      compactTargetPercent: settings.compact_target_percent,
      keepUncompactedMessages: settings.keep_uncompacted_messages
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
    const { maxEmojisPerMessage, proactiveMessageHours, dailyProactiveLimit, proactiveAwayChance, proactiveBusyChance, pacingStyle, proactiveCheckInterval, maxConsecutiveProactive, proactiveCooldownMultiplier, dailyLeftOnReadLimit, leftOnReadTriggerMin, leftOnReadTriggerMax, leftOnReadCharacterCooldown, compactThresholdPercent, compactTargetPercent, keepUncompactedMessages } = req.body;
    const userId = req.user.id;

    // Validate parameters
    if (maxEmojisPerMessage !== undefined && (maxEmojisPerMessage < 0 || maxEmojisPerMessage > 5)) {
      return res.status(400).json({ error: 'Max emojis per message must be between 0 and 5' });
    }
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
    if (proactiveCheckInterval !== undefined && (proactiveCheckInterval < 1 || proactiveCheckInterval > 60)) {
      return res.status(400).json({ error: 'Proactive check interval must be between 1 and 60 minutes' });
    }
    if (dailyLeftOnReadLimit !== undefined && (dailyLeftOnReadLimit < 0 || dailyLeftOnReadLimit > 50)) {
      return res.status(400).json({ error: 'Daily left-on-read limit must be between 0 and 50' });
    }
    if (leftOnReadTriggerMin !== undefined && (leftOnReadTriggerMin < 1 || leftOnReadTriggerMin > 30)) {
      return res.status(400).json({ error: 'Left-on-read trigger minimum must be between 1 and 30 minutes' });
    }
    if (leftOnReadTriggerMax !== undefined && (leftOnReadTriggerMax < 5 || leftOnReadTriggerMax > 60)) {
      return res.status(400).json({ error: 'Left-on-read trigger maximum must be between 5 and 60 minutes' });
    }
    if (leftOnReadCharacterCooldown !== undefined && (leftOnReadCharacterCooldown < 30 || leftOnReadCharacterCooldown > 480)) {
      return res.status(400).json({ error: 'Left-on-read character cooldown must be between 30 and 480 minutes' });
    }
    if (maxConsecutiveProactive !== undefined && (maxConsecutiveProactive < 1 || maxConsecutiveProactive > 10)) {
      return res.status(400).json({ error: 'Max consecutive proactive must be between 1 and 10' });
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

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (maxEmojisPerMessage !== undefined) {
      updates.push('max_emojis_per_message = ?');
      values.push(maxEmojisPerMessage);
    }
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
    if (dailyLeftOnReadLimit !== undefined) {
      updates.push('daily_left_on_read_limit = ?');
      values.push(dailyLeftOnReadLimit);
    }
    if (leftOnReadTriggerMin !== undefined) {
      updates.push('left_on_read_trigger_min = ?');
      values.push(leftOnReadTriggerMin);
    }
    if (leftOnReadTriggerMax !== undefined) {
      updates.push('left_on_read_trigger_max = ?');
      values.push(leftOnReadTriggerMax);
    }
    if (leftOnReadCharacterCooldown !== undefined) {
      updates.push('left_on_read_character_cooldown = ?');
      values.push(leftOnReadCharacterCooldown);
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

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    if (updates.length === 1) { // Only updated_at
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    // Get updated settings
    const settings = db.prepare(`
      SELECT max_emojis_per_message, proactive_message_hours, daily_proactive_limit,
             proactive_away_chance, proactive_busy_chance, pacing_style, proactive_check_interval,
             max_consecutive_proactive, proactive_cooldown_multiplier,
             daily_left_on_read_limit, left_on_read_trigger_min, left_on_read_trigger_max, left_on_read_character_cooldown,
             compact_threshold_percent, compact_target_percent, keep_uncompacted_messages
      FROM users WHERE id = ?
    `).get(userId);

    res.json({
      maxEmojisPerMessage: settings.max_emojis_per_message,
      proactiveMessageHours: settings.proactive_message_hours,
      dailyProactiveLimit: settings.daily_proactive_limit,
      proactiveAwayChance: settings.proactive_away_chance,
      proactiveBusyChance: settings.proactive_busy_chance,
      pacingStyle: settings.pacing_style,
      proactiveCheckInterval: settings.proactive_check_interval,
      maxConsecutiveProactive: settings.max_consecutive_proactive,
      proactiveCooldownMultiplier: settings.proactive_cooldown_multiplier,
      dailyLeftOnReadLimit: settings.daily_left_on_read_limit,
      leftOnReadTriggerMin: settings.left_on_read_trigger_min,
      leftOnReadTriggerMax: settings.left_on_read_trigger_max,
      leftOnReadCharacterCooldown: settings.left_on_read_character_cooldown,
      compactThresholdPercent: settings.compact_threshold_percent,
      compactTargetPercent: settings.compact_target_percent,
      keepUncompactedMessages: settings.keep_uncompacted_messages
    });
  } catch (error) {
    console.error('Update behavior settings error:', error);
    res.status(500).json({ error: 'Failed to update behavior settings' });
  }
});

export default router;
