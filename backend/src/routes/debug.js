import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import sdService from '../services/sdService.js';
import db from '../db/database.js';

const router = express.Router();

/**
 * Debug endpoint to clear all posts
 */
router.delete('/clear-posts', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    // Delete all posts for this user's characters
    const result = db.prepare(`
      DELETE FROM posts
      WHERE character_id IN (
        SELECT id FROM characters WHERE user_id = ?
      )
    `).run(userId);

    console.log(`🗑️  Debug: Cleared ${result.changes} posts`);

    res.json({
      success: true,
      deleted: result.changes
    });
  } catch (error) {
    console.error('Debug clear posts error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Debug endpoint to trigger proactive message for a character
 */
router.post('/trigger-proactive/:characterId', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    console.log(`🐛 Debug: Triggering proactive message for character ${characterId}`);

    // Get proactive message service
    const proactiveMessageService = (await import('../services/proactiveMessageService.js')).default;

    // Get IO instance from app
    const io = req.app.get('io');

    // Trigger proactive check for this specific character
    await proactiveMessageService.checkAndSend(io, characterId);

    res.json({
      success: true,
      message: 'Proactive message check triggered'
    });
  } catch (error) {
    console.error('Debug trigger proactive error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Debug endpoint to generate an image for a character
 * Supports both matched characters (from backend) and unmatched characters (from IndexedDB via request body)
 */
router.post('/generate-image/:characterId', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    const { contextTags, imageTags: providedImageTags, additionalPrompt } = req.body;
    const userId = req.user.id;

    console.log(`🐛 Debug: Generating image for character ${characterId}`);
    if (additionalPrompt) {
      console.log(`🎨 Additional prompt: ${additionalPrompt}`);
    }

    let imageTags = providedImageTags; // Use provided tags from request body (for unmatched characters)

    // If no tags provided, try to get from backend (for matched characters)
    if (!imageTags) {
      const character = db.prepare(`
        SELECT * FROM characters WHERE id = ? AND user_id = ?
      `).get(characterId, userId);

      if (character) {
        imageTags = character.image_tags;
        console.log(`🎨 Using image tags from backend`);
      }
    } else {
      console.log(`🎨 Using image tags from request body (unmatched character)`);
    }

    if (!imageTags) {
      return res.status(400).json({ error: 'No image tags available. Please configure image tags first.' });
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
      additionalPrompt: additionalPrompt || '',
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
