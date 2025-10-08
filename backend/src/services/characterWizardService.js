import axios from 'axios';
import db from '../db/database.js';
import llmSettingsService from './llmSettingsService.js';
import sdService from './sdService.js';

class CharacterWizardService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  }

  /**
   * Generate character name and description using LLM
   */
  async generateDescription({ age, archetype, personalityTags, userId }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      // Get user's Content LLM settings
      const userSettings = llmSettingsService.getUserSettings(userId);

      const prompt = `Create a unique female character for a dating app AI:

- Gender: Female
- Age: ${age}
- Archetype: ${archetype}
- Personality Traits: ${personalityTags.join(', ')}

Generate a fitting name and detailed description. Format your response EXACTLY like this:

NAME: [Full name (first and last) or a nickname]

DESCRIPTION:
[2-3 paragraphs covering background, occupation, personality traits, interests, hobbies, likes/dislikes, and communication style]

This description will be used to guide the AI's behavior in conversations. Make it detailed and natural.`;

      console.log('🧙 Wizard: Generating character name and description...');

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: userSettings.model,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: userSettings.temperature,
          max_tokens: userSettings.max_tokens,
          top_p: userSettings.top_p,
          frequency_penalty: userSettings.frequency_penalty,
          presence_penalty: userSettings.presence_penalty,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://localhost:3000',
            'X-Title': 'Cupid-AI Character Wizard',
          }
        }
      );

      const content = response.data.choices[0].message.content.trim();

      // Parse name and description
      const nameMatch = content.match(/NAME:\s*(.+)/i);
      const descriptionMatch = content.match(/DESCRIPTION:\s*([\s\S]+)/i);

      if (!nameMatch || !descriptionMatch) {
        throw new Error('Failed to parse generated content');
      }

      const name = nameMatch[1].trim();
      const description = descriptionMatch[1].trim();

      console.log('✅ Wizard: Character name and description generated');

      return { name, description };
    } catch (error) {
      console.error('❌ Wizard: Failed to generate character:', error.message);
      throw new Error('Failed to generate character');
    }
  }

  /**
   * Generate appearance suggestions using LLM
   */
  async generateAppearance({ age, archetype, personalityTags, userId }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      // Get user's Content LLM settings
      const userSettings = llmSettingsService.getUserSettings(userId);

      const prompt = `Based on this character profile, suggest a cohesive appearance:

- Age: ${age}
- Archetype: ${archetype}
- Personality: ${personalityTags.join(', ')}

Choose ONE option from each category that fits the character naturally. Respond EXACTLY in this format:

HAIR_COLOR: [Blonde|Brunette|Black|Red|Auburn|Platinum|Pink|Purple|Blue]
HAIR_STYLE: [Long Straight|Long Wavy|Long Curly|Medium Length|Bob Cut|Pixie Cut|Ponytail|Braided]
EYE_COLOR: [Brown|Blue|Green|Hazel|Gray|Amber|Violet]
BODY_TYPE: [Petite|Slim|Athletic|Curvy|Plus Size]
STYLE: [Casual|Elegant|Sporty|Gothic|Cute|Professional]`;

      console.log('🧙 Wizard: Generating appearance suggestions...');

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: userSettings.model,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 200,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://localhost:3000',
            'X-Title': 'Cupid-AI Character Wizard',
          }
        }
      );

      const content = response.data.choices[0].message.content.trim();

      console.log('🔍 LLM Response:', content);

      // Parse appearance selections (match at line start to avoid partial matches)
      const hairColorMatch = content.match(/^HAIR[_\s]*COLOR:\s*(.+)/mi);
      const hairStyleMatch = content.match(/^HAIR[_\s]*STYLE:\s*(.+)/mi);
      const eyeColorMatch = content.match(/^EYE[_\s]*COLOR:\s*(.+)/mi);
      const bodyTypeMatch = content.match(/^BODY[_\s]*TYPE:\s*(.+)/mi);
      const styleMatch = content.match(/^STYLE:\s*(.+)/mi);

      const appearance = {
        hairColor: hairColorMatch ? hairColorMatch[1].trim() : 'Brunette',
        hairStyle: hairStyleMatch ? hairStyleMatch[1].trim() : 'Long Straight',
        eyeColor: eyeColorMatch ? eyeColorMatch[1].trim() : 'Brown',
        bodyType: bodyTypeMatch ? bodyTypeMatch[1].trim() : 'Slim',
        style: styleMatch ? styleMatch[1].trim() : 'Casual'
      };

      console.log('✅ Wizard: Appearance suggestions generated:', appearance);

      return appearance;
    } catch (error) {
      console.error('❌ Wizard: Failed to generate appearance:', error.message);
      throw new Error('Failed to generate appearance');
    }
  }

  /**
   * Build Danbooru tags from appearance selections
   */
  buildImageTags(appearance) {
    const tags = [];

    // Hair
    if (appearance.hairColor) {
      tags.push(`${appearance.hairColor.toLowerCase()} hair`);
    }
    if (appearance.hairStyle) {
      tags.push(appearance.hairStyle.toLowerCase());
    }

    // Eyes
    if (appearance.eyeColor) {
      tags.push(`${appearance.eyeColor.toLowerCase()} eyes`);
    }

    // Body
    if (appearance.bodyType) {
      tags.push(appearance.bodyType.toLowerCase());
    }

    // Style/Clothing
    if (appearance.style) {
      const styleMap = {
        'casual': 'casual clothing',
        'elegant': 'elegant dress',
        'sporty': 'sportswear',
        'gothic': 'gothic fashion',
        'cute': 'cute outfit',
        'professional': 'business attire'
      };
      tags.push(styleMap[appearance.style.toLowerCase()] || 'casual clothing');
    }

    return tags.join(', ');
  }

  /**
   * Get user's SD settings from database
   */
  getSDSettings(userId) {
    try {
      const settings = db.prepare(`
        SELECT sd_steps, sd_cfg_scale, sd_sampler, sd_scheduler,
               sd_enable_hr, sd_hr_scale, sd_hr_upscaler, sd_hr_steps,
               sd_hr_cfg, sd_denoising_strength, sd_enable_adetailer, sd_adetailer_model,
               sd_main_prompt, sd_negative_prompt, sd_model
        FROM users WHERE id = ?
      `).get(userId);

      if (!settings) {
        // Return defaults
        return {
          sd_steps: 30,
          sd_cfg_scale: 7.0,
          sd_sampler: 'DPM++ 2M',
          sd_scheduler: 'Karras',
          sd_enable_hr: 1,
          sd_hr_scale: 1.5,
          sd_hr_upscaler: 'remacri_original',
          sd_hr_steps: 15,
          sd_hr_cfg: 5.0,
          sd_denoising_strength: 0.7,
          sd_enable_adetailer: 1,
          sd_adetailer_model: 'face_yolov8n.pt',
          sd_main_prompt: 'masterpiece, best quality, amazing quality',
          sd_negative_prompt: 'nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry',
          sd_model: ''
        };
      }

      return settings;
    } catch (error) {
      console.error('Error fetching SD settings:', error);
      // Return defaults on error
      return {
        sd_steps: 30,
        sd_cfg_scale: 7.0,
        sd_sampler: 'DPM++ 2M',
        sd_scheduler: 'Karras',
        sd_enable_hr: 1,
        sd_hr_scale: 1.5,
        sd_hr_upscaler: 'remacri_original',
        sd_hr_steps: 15,
        sd_hr_cfg: 5.0,
        sd_denoising_strength: 0.7,
        sd_enable_adetailer: 1,
        sd_adetailer_model: 'face_yolov8n.pt',
        sd_main_prompt: 'masterpiece, best quality, amazing quality',
        sd_negative_prompt: 'nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry',
        sd_model: ''
      };
    }
  }

  /**
   * Generate enhanced Danbooru tags for dating profile image
   */
  async generateImageTags({ appearance, age, archetype, personalityTags, userId }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      // Get user's Content LLM settings
      const userSettings = llmSettingsService.getUserSettings(userId);

      // Build base appearance tags
      const baseAppearanceTags = this.buildImageTags(appearance);

      const prompt = `You are an expert at creating Danbooru-style image tags for anime character art generation.

Create tags for a dating profile picture with the following character:

APPEARANCE: ${baseAppearanceTags}
AGE: ${age}
ARCHETYPE: ${archetype}
PERSONALITY: ${personalityTags.join(', ')}

Add 5-10 enhancement tags to make this a good dating profile picture:
- ONE facial expression tag (smiling, grin, etc.)
- ONE pose/body language tag (looking at viewer, waving, etc.)
- ONE setting tag (outdoors, cafe, park, etc.)
- ONE lighting tag (warm lighting, soft lighting, etc.)
- 1-3 personality-driven tags

Keep it concise! Too many tags reduces quality.

Respond with ONLY comma-separated Danbooru tags. Start with the base appearance tags, then add your enhancements.

Example: "1girl, solo, blonde hair, long hair, blue eyes, smiling, looking at viewer, outdoors, park, warm lighting, happy"`;

      console.log('🎨 Wizard: Generating enhanced image tags with LLM...');

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: userSettings.model,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.8,
          max_tokens: 300,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://localhost:3000',
            'X-Title': 'Cupid-AI Character Wizard',
          }
        }
      );

      const tags = response.data.choices[0].message.content.trim();

      console.log('✅ Wizard: Enhanced image tags generated:', tags);

      return tags;
    } catch (error) {
      console.error('❌ Wizard: Failed to generate image tags:', error.message);
      // Fallback to basic tags
      return this.buildImageTags(appearance);
    }
  }

  /**
   * Generate character image using Stable Diffusion
   */
  async generateImage({ appearance, age, archetype, personalityTags, userId }) {
    try {
      // Build base appearance tags (for storage)
      const baseAppearanceTags = this.buildImageTags(appearance);

      // Generate enhanced tags using LLM (for one-time profile pic generation)
      const enhancedTags = await this.generateImageTags({
        appearance,
        age,
        archetype,
        personalityTags,
        userId
      });

      console.log('🎨 Wizard: Generating character image with enhanced tags');

      // Get user's SD settings
      const userSettings = this.getSDSettings(userId);

      // Use existing SD service with enhanced tags
      const result = await sdService.generateImage({
        characterTags: enhancedTags,
        contextTags: '',
        userSettings
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      console.log('✅ Wizard: Character image generated');

      return {
        imageBuffer: result.imageBuffer,
        imageTags: baseAppearanceTags // Store only base appearance, not enhancements
      };
    } catch (error) {
      console.error('❌ Wizard: Failed to generate image:', error.message);
      throw new Error('Failed to generate character image. Make sure Stable Diffusion WebUI is running.');
    }
  }
}

export default new CharacterWizardService();
