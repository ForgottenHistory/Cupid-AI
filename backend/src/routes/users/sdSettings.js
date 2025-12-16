import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import db from '../../db/database.js';

const router = express.Router();

/**
 * GET /api/users/sd-settings
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const settings = db.prepare(`
      SELECT sd_steps, sd_cfg_scale, sd_sampler, sd_scheduler,
             sd_enable_hr, sd_hr_scale, sd_hr_upscaler, sd_hr_steps,
             sd_hr_cfg, sd_denoising_strength, sd_enable_adetailer, sd_adetailer_model,
             sd_main_prompt, sd_negative_prompt, sd_model,
             sd_width, sd_height, sd_randomize_orientation
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
      sd_model: settings.sd_model || '',
      sd_width: settings.sd_width || 896,
      sd_height: settings.sd_height || 1152,
      sd_randomize_orientation: Boolean(settings.sd_randomize_orientation)
    });
  } catch (error) {
    console.error('Get SD settings error:', error);
    res.status(500).json({ error: 'Failed to get SD settings' });
  }
});

/**
 * PUT /api/users/sd-settings
 */
router.put('/', authenticateToken, (req, res) => {
  try {
    const {
      sd_steps, sd_cfg_scale, sd_sampler, sd_scheduler,
      sd_enable_hr, sd_hr_scale, sd_hr_upscaler, sd_hr_steps,
      sd_hr_cfg, sd_denoising_strength, sd_enable_adetailer, sd_adetailer_model,
      sd_main_prompt, sd_negative_prompt, sd_model,
      sd_width, sd_height, sd_randomize_orientation
    } = req.body;
    const userId = req.user.id;

    db.prepare(`
      UPDATE users
      SET sd_steps = ?, sd_cfg_scale = ?, sd_sampler = ?, sd_scheduler = ?,
          sd_enable_hr = ?, sd_hr_scale = ?, sd_hr_upscaler = ?, sd_hr_steps = ?,
          sd_hr_cfg = ?, sd_denoising_strength = ?, sd_enable_adetailer = ?, sd_adetailer_model = ?,
          sd_main_prompt = ?, sd_negative_prompt = ?, sd_model = ?,
          sd_width = ?, sd_height = ?, sd_randomize_orientation = ?
      WHERE id = ?
    `).run(
      sd_steps, sd_cfg_scale, sd_sampler, sd_scheduler,
      sd_enable_hr ? 1 : 0, sd_hr_scale, sd_hr_upscaler, sd_hr_steps,
      sd_hr_cfg, sd_denoising_strength, sd_enable_adetailer ? 1 : 0, sd_adetailer_model,
      sd_main_prompt, sd_negative_prompt, sd_model,
      sd_width, sd_height, sd_randomize_orientation ? 1 : 0,
      userId
    );

    res.json({ success: true, message: 'SD settings updated successfully' });
  } catch (error) {
    console.error('Update SD settings error:', error);
    res.status(500).json({ error: 'Failed to update SD settings' });
  }
});

export default router;
