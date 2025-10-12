import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import aiService from './aiService.js';
import llmSettingsService from './llmSettingsService.js';
import { loadImageTagPrompts } from '../routes/imageTagPrompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImageTagGenerationService {
  constructor() {
    this.tagLibrary = null;
    this.loadTagLibrary();
  }

  /**
   * Load Danbooru tag library from file
   */
  loadTagLibrary() {
    try {
      const tagLibraryPath = path.join(__dirname, '../../danbooru_tags.txt');
      this.tagLibrary = fs.readFileSync(tagLibraryPath, 'utf-8');
      console.log('✅ Loaded Danbooru tag library');
    } catch (error) {
      console.error('❌ Failed to load Danbooru tag library:', error.message);
      this.tagLibrary = '';
    }
  }

  /**
   * Generate context-aware image tags using LLM
   * @param {Array} recentMessages - Last 50 messages from conversation
   * @param {string} contextualTags - Character-specific contextual tags
   * @param {Object} currentStatus - Character's current status and activity
   * @param {number} userId - User ID for getting Image Tag LLM settings
   * @returns {Promise<string>} Comma-separated validated tags
   */
  async generateTags({ recentMessages, contextualTags, currentStatus, userId }) {
    try {
      console.log('🎨 Generating image tags from conversation context...');

      // Get user's Image Tag LLM settings
      const userSettings = llmSettingsService.getImageTagSettings(userId);
      console.log(`🎨 Using Image Tag LLM settings:`, {
        provider: userSettings.provider,
        model: userSettings.model,
        temperature: userSettings.temperature,
        max_tokens: userSettings.max_tokens
      });

      // Extract previous image tags for visual consistency
      const previousImageTags = recentMessages
        .filter(msg => msg.message_type === 'image' && msg.image_tags)
        .map(msg => msg.image_tags);

      if (previousImageTags.length > 0) {
        console.log(`📸 Found ${previousImageTags.length} previous image(s) - will maintain visual consistency`);
      }

      // Format recent messages for context
      const conversationContext = recentMessages
        .map(msg => `${msg.role === 'user' ? 'User' : 'Character'}: ${msg.content}`)
        .join('\n');

      // Build prompt for LLM with previous image tags
      const prompt = this.buildTagGenerationPrompt(conversationContext, contextualTags, currentStatus, previousImageTags);

      // Call LLM to generate tags using user's configured settings
      const response = await aiService.createBasicCompletion(prompt, {
        provider: userSettings.provider,
        model: userSettings.model,
        temperature: userSettings.temperature,
        max_tokens: userSettings.max_tokens,
        top_p: userSettings.top_p,
        frequency_penalty: userSettings.frequency_penalty,
        presence_penalty: userSettings.presence_penalty,
        reasoning_effort: 'low', // Low reasoning effort (~20% of tokens) if supported
        messageType: 'image-tags',
        userId: userId // Pass userId so aiService uses correct provider
      });

      // Log full response to see reasoning output
      console.log('🧠 DeepSeek FULL RESPONSE:', JSON.stringify(response, null, 2));

      const generatedTags = response.content.trim();
      console.log('🤖 LLM generated tags:', generatedTags);

      // Validate and filter tags (pass contextual tags so they're exempt from validation)
      const validatedTags = this.validateTags(generatedTags, contextualTags);
      console.log('✅ Validated tags:', validatedTags);

      return validatedTags;
    } catch (error) {
      console.error('❌ Failed to generate image tags:', error.message);
      // Fallback to empty string if generation fails
      return '';
    }
  }

  /**
   * Build prompt for LLM tag generation
   */
  buildTagGenerationPrompt(conversationContext, contextualTags, currentStatus, previousImageTags) {
    // Load prompts from config
    const prompts = loadImageTagPrompts();

    // Format current status info
    let statusInfo = 'Unknown';
    if (currentStatus) {
      statusInfo = currentStatus.status;
      if (currentStatus.activity) {
        statusInfo += ` (${currentStatus.activity})`;
      }
    }

    // Build base prompt
    let prompt = `${prompts.systemPrompt}

Here is the COMPLETE library of valid Danbooru tags you can choose from:

${this.tagLibrary}

---

Character-specific contextual tags (you MAY include these if relevant):
${contextualTags || 'none'}

---

Recent conversation:
${conversationContext}

---

IMPORTANT - Character's current status: ${statusInfo}
Consider this status when selecting location, activity, and clothing tags.

---

Based on the conversation and current status, select appropriate Danbooru tags from the tag library and character-specific tags.

**IMPORTANT - This is a DATING APP**: Images should vary from casual/SFW to full on NSFW imagery based on the conversation's tone and context.

${prompts.guidelinesPrompt}

${prompts.scalePrompt}

${prompts.contextAnalysisPrompt}

${prompts.boldnessPrompt}

${prompts.varietyPrompt || ''}

${prompts.closingInstructionsPrompt}`;

    // Add previous image tags section if available for VISUAL CONSISTENCY
    if (previousImageTags && previousImageTags.length > 0) {
      prompt += `

---

⚠️ CRITICAL - PREVIOUS IMAGES IN THIS CONVERSATION:

${previousImageTags.map((tags, index) => `Image ${index + 1}: ${tags}`).join('\n')}

${prompts.visualConsistencyPrompt}`;
    }

    prompt += `

${prompts.exampleOutputPrompt}

Your selected tags:`;

    return prompt;
  }

  /**
   * Validate generated tags against the tag library
   * @param {string} generatedTags - Comma-separated tags from LLM
   * @param {string} contextualTags - Character-specific contextual tags (exempt from validation)
   * @returns {string} Comma-separated validated tags
   */
  validateTags(generatedTags, contextualTags = '') {
    // Common colors that can be prefixed to clothing items
    const validColors = [
      'white', 'black', 'red', 'blue', 'green', 'yellow', 'orange', 'purple',
      'pink', 'brown', 'grey', 'gray', 'beige', 'navy', 'teal', 'cyan',
      'magenta', 'maroon', 'olive', 'lime', 'indigo', 'violet', 'turquoise',
      'gold', 'silver', 'bronze', 'cream', 'khaki', 'tan', 'denim'
    ];

    // Common style descriptors that can be prefixed to clothing items
    const validDescriptors = [
      'off-shoulder', 'tight', 'loose', 'oversized', 'fitted', 'baggy',
      'pleated', 'ripped', 'torn', 'distressed', 'faded', 'vintage',
      'cropped', 'short', 'long', 'midi', 'maxi', 'mini',
      'sleeveless', 'strapless', 'backless', 'halter', 'v-neck', 'crew-neck',
      'high-waisted', 'low-cut', 'low-rise', 'high-rise',
      'skinny', 'slim', 'straight', 'wide-leg', 'flared', 'bootcut',
      'sports', 'athletic', 'casual', 'formal', 'summer', 'winter'
    ];

    // Parse contextual tags into a set for quick lookup (case-insensitive)
    const contextualTagsSet = new Set(
      contextualTags
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0)
    );

    // Parse generated tags
    const tags = generatedTags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    // Create set of valid tags (case-insensitive)
    const validTagsSet = new Set(
      this.tagLibrary
        .split(/[\n,]/)
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0 && !tag.startsWith('#'))
    );

    // Filter valid tags
    const validTags = [];
    const invalidTags = [];

    for (const tag of tags) {
      const normalizedTag = tag.toLowerCase();

      // FIRST: Check if tag is a contextual tag (exempt from validation)
      if (contextualTagsSet.has(normalizedTag)) {
        validTags.push(tag);
        continue;
      }

      // Check if tag exists directly in library
      if (validTagsSet.has(normalizedTag)) {
        validTags.push(tag);
        continue;
      }

      // Check if it's a color/style + clothing combination (e.g., "white crop top", "off-shoulder blouse", "blue denim shorts")
      // Combine colors and descriptors into one valid modifier list
      const validModifiers = [...validColors, ...validDescriptors];

      let isValidCombo = false;
      const words = normalizedTag.split(' ');

      // Try progressively removing modifier words from the front
      for (let i = 0; i < words.length - 1; i++) {
        const potentialBase = words.slice(i + 1).join(' ');

        // Check if remaining words form a valid tag
        if (validTagsSet.has(potentialBase)) {
          // Verify all removed words are valid colors/descriptors
          const removedWords = words.slice(0, i + 1);
          const allModifiersValid = removedWords.every(word => validModifiers.includes(word));

          if (allModifiersValid) {
            validTags.push(tag);
            isValidCombo = true;
            break;
          }
        }
      }

      if (!isValidCombo) {
        invalidTags.push(tag);
      }
    }

    if (invalidTags.length > 0) {
      console.log('⚠️  Discarded invalid tags:', invalidTags.join(', '));
    }

    return validTags.join(', ');
  }

  /**
   * Get recent messages from conversation (last 50)
   * Also fetches image_tags from any previous image messages for consistency
   * @param {number} conversationId - Conversation ID
   * @param {object} db - Database instance
   * @returns {Array} Last 50 messages with image_tags if present
   */
  getRecentMessages(conversationId, db) {
    const messages = db.prepare(`
      SELECT role, content, image_tags, message_type
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(conversationId);

    // Reverse to get chronological order
    return messages.reverse();
  }
}

export default new ImageTagGenerationService();
