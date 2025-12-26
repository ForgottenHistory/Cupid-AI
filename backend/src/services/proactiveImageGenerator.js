import db from '../db/database.js';

/**
 * Generate an image for a proactive message
 * @returns {Object} { success, imageUrl, imagePrompt, contextTags, messageType }
 */
export async function generateProactiveImage(characterId, conversationId, imageTags, characterData, userId) {
  console.log(`🎨 Generating image for proactive message from character ${characterId}`);

  try {
    // Get conversation for mood and state
    const conversation = db.prepare('SELECT character_mood, character_state FROM conversations WHERE id = ?').get(conversationId);

    // Use Image Tag LLM to generate context-aware tags
    const { default: imageTagGenerationService } = await import('./imageTagGenerationService.js');
    const recentMessages = imageTagGenerationService.getRecentMessages(conversationId, db);

    // Get current status from schedule
    const { getCurrentStatusFromSchedule } = await import('../utils/chatHelpers.js');
    const currentStatusInfo = getCurrentStatusFromSchedule(characterData.schedule);

    const generatedContextTags = await imageTagGenerationService.generateTags({
      recentMessages,
      contextualTags: characterData.contextualTags || '',
      currentStatus: currentStatusInfo,
      userId: userId,
      characterMood: conversation?.character_mood || null,
      characterState: conversation?.character_state || null
    });

    console.log(`🏷️ Generated context tags for proactive image:`, generatedContextTags);

    // Fetch user's SD settings
    const sdSettings = db.prepare(`
      SELECT sd_steps, sd_cfg_scale, sd_sampler, sd_scheduler,
             sd_enable_hr, sd_hr_scale, sd_hr_upscaler, sd_hr_steps,
             sd_hr_cfg, sd_denoising_strength, sd_enable_adetailer, sd_adetailer_model,
             sd_main_prompt, sd_negative_prompt, sd_model,
             sd_width, sd_height, sd_randomize_orientation
      FROM users WHERE id = ?
    `).get(userId);

    // Fetch character-specific prompt overrides
    const character = db.prepare(`
      SELECT main_prompt_override, negative_prompt_override
      FROM characters WHERE id = ? AND user_id = ?
    `).get(characterId, userId);

    // Generate image using SD
    const { default: sdService } = await import('./sdService.js');
    const imageResult = await sdService.generateImage({
      characterTags: imageTags,
      contextTags: generatedContextTags,
      userSettings: sdSettings,
      mainPromptOverride: character?.main_prompt_override,
      negativePromptOverride: character?.negative_prompt_override
    });

    if (imageResult.success) {
      // Save image file
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const imageDir = path.join(__dirname, '..', '..', 'uploads', 'images');
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }

      const timestamp = Date.now();
      const filename = `image_${characterId}_${timestamp}.png`;
      const filepath = path.join(imageDir, filename);

      fs.writeFileSync(filepath, imageResult.imageBuffer);

      const imageUrl = `/uploads/images/${filename}`;
      console.log(`✅ Proactive image generated: ${imageUrl}`);

      return {
        success: true,
        imageUrl,
        imagePrompt: imageResult.prompt,
        contextTags: generatedContextTags,
        messageType: 'image'
      };
    }

    return {
      success: false,
      imageUrl: null,
      imagePrompt: null,
      contextTags: null,
      messageType: 'text'
    };
  } catch (error) {
    console.error('❌ Proactive image generation failed:', error);
    return {
      success: false,
      imageUrl: null,
      imagePrompt: null,
      contextTags: null,
      messageType: 'text'
    };
  }
}
