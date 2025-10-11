import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SDService {
  constructor() {
    this.baseUrl = process.env.SD_SERVER_URL || 'http://127.0.0.1:7860';
    this.model = 'prefectIllustriousXL_v20p.safetensors';
  }

  /**
   * Generate image using Stable Diffusion with Highres fix and ADetailer
   * @param {Object} params
   * @param {string} params.characterTags - Character-specific Danbooru tags
   * @param {string} params.contextTags - Situational context tags from Decision LLM
   * @param {string} params.additionalPrompt - Optional additional user-provided prompt
   * @param {string} params.negativePrompt - Optional custom negative prompt
   * @param {Object} params.userSettings - User's SD settings from database
   */
  async generateImage({
    characterTags = '',
    contextTags = '',
    additionalPrompt = '',
    negativePrompt = null,
    userSettings = null
  }) {
    try {
      // Use user settings or defaults
      const settings = userSettings || {
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
        sd_main_prompt: 'masterpiece, best quality, amazing quality, 1girl, solo',
        sd_negative_prompt: 'lowres, bad anatomy, bad hands, text, error, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, speech bubble, multiple views,',
        sd_model: ''
      };

      // Build full prompt using user's main prompt
      const mainPrompt = settings.sd_main_prompt || 'masterpiece, best quality, amazing quality, 1girl, solo';
      const fullPrompt = [mainPrompt, characterTags, contextTags, additionalPrompt]
        .filter(p => p && p.trim())
        .join(', ');

      // Use user's negative prompt
      const mainNegative = settings.sd_negative_prompt || 'lowres, bad anatomy, bad hands, text, error, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, speech bubble, multiple views,';
      const fullNegative = negativePrompt || mainNegative;

      console.log(`🎨 Generating image with SD...`);
      console.log(`Prompt: ${fullPrompt}`);
      console.log(`User settings:`, userSettings);

      // Track generation time
      const startTime = Date.now();

      // Build base payload
      const payload = {
        prompt: fullPrompt,
        negative_prompt: fullNegative,
        width: 832,
        height: 1216,
        steps: settings.sd_steps,
        cfg_scale: settings.sd_cfg_scale,
        sampler_name: settings.sd_sampler,
        scheduler: settings.sd_scheduler,
        seed: -1,
        batch_size: 1,
        n_iter: 1,
        send_images: true,
        save_images: false
      };

      // Add model override if specified
      if (settings.sd_model && settings.sd_model.trim()) {
        payload.override_settings = {
          sd_model_checkpoint: settings.sd_model
        };
      }

      // Add ADetailer configuration if enabled
      if (Boolean(settings.sd_enable_adetailer)) {
        payload.alwayson_scripts = {
          ADetailer: {
            args: [
              true, // Enable ADetailer
              false, // Skip image generation if no detection
              {
                ad_model: settings.sd_adetailer_model,
                ad_model_classes: '',
                ad_tab_enable: true,
                ad_prompt: '',
                ad_negative_prompt: '',
                ad_confidence: 0.5,
                ad_mask_k: 0,
                ad_mask_min_ratio: 0,
                ad_mask_max_ratio: 1,
                ad_dilate_erode: 4,
                ad_x_offset: 0,
                ad_y_offset: 0,
                ad_mask_merge_invert: 'Merge',
                ad_mask_blur: 4,
                ad_mask_filter_method: 'Area',
                ad_denoising_strength: 0.4,
                ad_inpaint_only_masked: true,
                ad_inpaint_only_masked_padding: 32,
                ad_use_inpaint_width_height: false,
                ad_inpaint_width: 512,
                ad_inpaint_height: 512,
                ad_use_steps: false,
                ad_steps: 28,
                ad_use_cfg_scale: false,
                ad_cfg_scale: 7,
                ad_checkpoint: 'Use same checkpoint',
                ad_use_checkpoint: false,
                ad_use_sampler: false,
                ad_sampler: 'DPM++ 2M',
                ad_scheduler: 'Use same scheduler',
                ad_use_noise_multiplier: false,
                ad_noise_multiplier: 1,
                ad_use_clip_skip: false,
                ad_clip_skip: 1,
                ad_use_vae: false,
                ad_vae: 'Use same VAE',
                ad_restore_face: false,
                ad_controlnet_model: 'None',
                ad_controlnet_module: 'None',
                ad_controlnet_weight: 1,
                ad_controlnet_guidance_start: 0,
                ad_controlnet_guidance_end: 1,
                is_api: []
              },
              {
                ad_model: 'None',
                ad_model_classes: '',
                ad_tab_enable: true,
                ad_prompt: '',
                ad_negative_prompt: '',
                ad_confidence: 0.3,
                ad_mask_k: 0,
                ad_mask_min_ratio: 0,
                ad_mask_max_ratio: 1,
                ad_dilate_erode: 4,
                ad_x_offset: 0,
                ad_y_offset: 0,
                ad_mask_merge_invert: 'None',
                ad_mask_blur: 4,
                ad_mask_filter_method: 'Area',
                ad_denoising_strength: 0.4,
                ad_inpaint_only_masked: true,
                ad_inpaint_only_masked_padding: 32,
                ad_use_inpaint_width_height: false,
                ad_inpaint_width: 512,
                ad_inpaint_height: 512,
                ad_use_steps: false,
                ad_steps: 28,
                ad_use_cfg_scale: false,
                ad_cfg_scale: 7,
                ad_checkpoint: 'Use same checkpoint',
                ad_use_checkpoint: false,
                ad_use_sampler: false,
                ad_sampler: 'DPM++ 2M',
                ad_scheduler: 'Use same scheduler',
                ad_use_noise_multiplier: false,
                ad_noise_multiplier: 1,
                ad_use_clip_skip: false,
                ad_clip_skip: 1,
                ad_use_vae: false,
                ad_vae: 'Use same VAE',
                ad_restore_face: false,
                ad_controlnet_model: 'None',
                ad_controlnet_module: 'None',
                ad_controlnet_weight: 1,
                ad_controlnet_guidance_start: 0,
                ad_controlnet_guidance_end: 1,
                is_api: []
              },
              {
                ad_model: 'None',
                ad_model_classes: '',
                ad_tab_enable: true,
                ad_prompt: '',
                ad_negative_prompt: '',
                ad_confidence: 0.3,
                ad_mask_k: 0,
                ad_mask_min_ratio: 0,
                ad_mask_max_ratio: 1,
                ad_dilate_erode: 4,
                ad_x_offset: 0,
                ad_y_offset: 0,
                ad_mask_merge_invert: 'None',
                ad_mask_blur: 4,
                ad_mask_filter_method: 'Area',
                ad_denoising_strength: 0.4,
                ad_inpaint_only_masked: true,
                ad_inpaint_only_masked_padding: 32,
                ad_use_inpaint_width_height: false,
                ad_inpaint_width: 512,
                ad_inpaint_height: 512,
                ad_use_steps: false,
                ad_steps: 28,
                ad_use_cfg_scale: false,
                ad_cfg_scale: 7,
                ad_checkpoint: 'Use same checkpoint',
                ad_use_checkpoint: false,
                ad_use_sampler: false,
                ad_sampler: 'DPM++ 2M',
                ad_scheduler: 'Use same scheduler',
                ad_use_noise_multiplier: false,
                ad_noise_multiplier: 1,
                ad_use_clip_skip: false,
                ad_clip_skip: 1,
                ad_use_vae: false,
                ad_vae: 'Use same VAE',
                ad_restore_face: false,
                ad_controlnet_model: 'None',
                ad_controlnet_module: 'None',
                ad_controlnet_weight: 1,
                ad_controlnet_guidance_start: 0,
                ad_controlnet_guidance_end: 1,
                is_api: []
              }
            ]
          }
        };
      }

      // Add Highres fix parameters if enabled
      if (Boolean(settings.sd_enable_hr)) {
        payload.enable_hr = true;
        payload.hr_scale = settings.sd_hr_scale;
        payload.hr_upscaler = settings.sd_hr_upscaler;
        payload.hr_second_pass_steps = settings.sd_hr_steps;
        payload.hr_cfg = settings.sd_hr_cfg;
        payload.hr_additional_modules = ['Use same choices'];
        payload.denoising_strength = settings.sd_denoising_strength;
        payload.hr_resize_x = 832 * settings.sd_hr_scale;
        payload.hr_resize_y = 1216 * settings.sd_hr_scale;
      }

      // Make request to SD server
      const response = await axios.post(
        `${this.baseUrl}/sdapi/v1/txt2img`,
        payload,
        { timeout: 300000 } // 5 minute timeout
      );

      if (!response.data || !response.data.images || response.data.images.length === 0) {
        throw new Error('No images returned from SD server');
      }

      // Get base64 image
      const base64Image = response.data.images[0];

      const generationTime = Date.now() - startTime;

      // Log prompt to file
      const logFilename = this.saveImagePromptLog({
        prompt: fullPrompt,
        negativePrompt: fullNegative,
        characterTags,
        contextTags,
        additionalPrompt,
        settings
      });

      return {
        success: true,
        imageBuffer: Buffer.from(base64Image, 'base64'),
        prompt: fullPrompt,
        negativePrompt: fullNegative,
        logFilename,
        generationTime
      };
    } catch (error) {
      console.error('SD generation error:', error.message);

      // Still try to log the failure
      const logFilename = this.saveImagePromptLog({
        prompt: fullPrompt || 'N/A',
        negativePrompt: fullNegative || 'N/A',
        characterTags: characterTags || '',
        contextTags: contextTags || '',
        additionalPrompt: additionalPrompt || '',
        settings: settings || {}
      });

      if (logFilename) {
        this.appendImageResult({
          logFilename,
          success: false,
          error: error.message
        });
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Save image generation prompt to log file
   */
  saveImagePromptLog({ prompt, negativePrompt, characterTags, contextTags, additionalPrompt, settings }) {
    try {
      const logsDir = path.join(__dirname, '../../logs/prompts');

      // Create directory if it doesn't exist
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Generate filename with timestamp
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `image-${timestamp}.txt`;
      const filepath = path.join(logsDir, filename);

      // Build log content
      const logContent = `IMAGE GENERATION PROMPT LOG
Timestamp: ${now.toISOString()}

=== FULL PROMPT ===
${prompt}

=== NEGATIVE PROMPT ===
${negativePrompt}

=== BREAKDOWN ===
Main Prompt: ${settings.sd_main_prompt || 'masterpiece, best quality, amazing quality, 1girl, solo'}
Character Tags: ${characterTags || 'none'}
Context Tags: ${contextTags || 'none'}
Additional Prompt: ${additionalPrompt || 'none'}

=== SETTINGS ===
Model: ${settings.sd_model || 'default'}
Steps: ${settings.sd_steps}
CFG Scale: ${settings.sd_cfg_scale}
Sampler: ${settings.sd_sampler}
Scheduler: ${settings.sd_scheduler}
Highres Fix: ${Boolean(settings.sd_enable_hr) ? 'enabled' : 'disabled'}${Boolean(settings.sd_enable_hr) ? `
  - Scale: ${settings.sd_hr_scale}x
  - Upscaler: ${settings.sd_hr_upscaler}
  - Steps: ${settings.sd_hr_steps}
  - CFG: ${settings.sd_hr_cfg}
  - Denoising: ${settings.sd_denoising_strength}` : ''}
ADetailer: ${Boolean(settings.sd_enable_adetailer) ? `enabled (${settings.sd_adetailer_model})` : 'disabled'}

=== RESULT ===
Status: Pending...
`;

      // Write to file
      fs.writeFileSync(filepath, logContent, 'utf8');

      // Keep only last 10 image prompt logs
      const files = fs.readdirSync(logsDir)
        .filter(f => f.startsWith('image-'))
        .map(f => ({
          name: f,
          path: path.join(logsDir, f),
          mtime: fs.statSync(path.join(logsDir, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Delete old files (keep only 10 newest)
      if (files.length > 10) {
        files.slice(10).forEach(file => {
          fs.unlinkSync(file.path);
          console.log(`🗑️  Deleted old image prompt log: ${file.name}`);
        });
      }

      console.log(`📝 Saved image prompt log: ${filename}`);
      return filename; // Return filename so result can be appended
    } catch (error) {
      console.error('Failed to save image prompt log:', error.message);
      return null;
    }
  }

  /**
   * Append result to the most recent image prompt log
   */
  appendImageResult({ logFilename, success, imagePath, error, generationTime }) {
    try {
      if (!logFilename) return;

      const logsDir = path.join(__dirname, '../../logs/prompts');
      const filepath = path.join(logsDir, logFilename);

      if (!fs.existsSync(filepath)) {
        console.warn(`⚠️  Log file not found: ${logFilename}`);
        return;
      }

      // Read existing content
      let content = fs.readFileSync(filepath, 'utf8');

      // Replace the pending result section
      const resultSection = `=== RESULT ===
Status: ${success ? '✅ SUCCESS' : '❌ FAILED'}${success ? `
Image Path: ${imagePath}
Generation Time: ${generationTime}ms` : ''}${error ? `
Error: ${error}` : ''}
`;

      content = content.replace(/=== RESULT ===\nStatus: Pending\.\.\./, resultSection.trim());

      // Write updated content
      fs.writeFileSync(filepath, content, 'utf8');
      console.log(`📝 Updated image prompt log with result: ${logFilename}`);
    } catch (error) {
      console.error('Failed to append image result:', error.message);
    }
  }

  /**
   * Check if SD server is available
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}/sdapi/v1/sd-models`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.error('SD server health check failed:', error.message);
      return false;
    }
  }
}

export default new SDService();
