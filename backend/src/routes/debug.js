import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import sdService from '../services/sdService.js';
import db from '../db/database.js';

const router = express.Router();

/**
 * Debug endpoint to generate an image for a character
 */
router.post('/generate-image/:characterId', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    const { contextTags } = req.body;
    const userId = req.user.id;

    console.log(`🐛 Debug: Generating image for character ${characterId}`);

    // Get character from backend
    const character = db.prepare(`
      SELECT * FROM characters WHERE id = ? AND user_id = ?
    `).get(characterId, userId);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const imageTags = character.image_tags;
    if (!imageTags) {
      return res.status(400).json({ error: 'Character has no image tags configured' });
    }

    console.log(`🎨 Character tags: ${imageTags}`);
    console.log(`🎨 Context tags: ${contextTags || 'none'}`);

    // Fetch user's SD settings
    const userSettings = db.prepare(`
      SELECT sd_steps, sd_cfg_scale, sd_sampler, sd_scheduler,
             sd_enable_hr, sd_hr_scale, sd_hr_upscaler, sd_hr_steps,
             sd_hr_cfg, sd_denoising_strength, sd_enable_adetailer, sd_adetailer_model,
             sd_main_prompt, sd_negative_prompt, sd_model
      FROM users WHERE id = ?
    `).get(userId);

    // Generate image
    const imageResult = await sdService.generateImage({
      characterTags: imageTags,
      contextTags: contextTags || '',
      userSettings: userSettings
    });

    if (!imageResult.success) {
      return res.status(500).json({ error: imageResult.error });
    }

    // Return base64 image
    const base64Image = imageResult.imageBuffer.toString('base64');
    res.json({
      success: true,
      image: `data:image/png;base64,${base64Image}`,
      prompt: imageResult.prompt,
      negativePrompt: imageResult.negativePrompt
    });
  } catch (error) {
    console.error('Debug image generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
