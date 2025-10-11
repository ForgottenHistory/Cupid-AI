import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import aiService from './aiService.js';

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
   * @param {Array} recentMessages - Last 10 messages from conversation
   * @param {string} contextualTags - Character-specific contextual tags
   * @param {Object} currentStatus - Character's current status and activity
   * @param {Object} userSettings - User's LLM settings
   * @returns {Promise<string>} Comma-separated validated tags
   */
  async generateTags({ recentMessages, contextualTags, currentStatus, userSettings }) {
    try {
      console.log('🎨 Generating image tags from conversation context...');

      // Format recent messages for context
      const conversationContext = recentMessages
        .map(msg => `${msg.role === 'user' ? 'User' : 'Character'}: ${msg.content}`)
        .join('\n');

      // Build prompt for LLM
      const prompt = this.buildTagGenerationPrompt(conversationContext, contextualTags, currentStatus);

      // Call LLM to generate tags using basic completion (no character context needed)
      const response = await aiService.createBasicCompletion(prompt, {
        model: userSettings.llm_model,
        temperature: userSettings.llm_temperature,
        max_tokens: userSettings.llm_max_tokens || 300,
        top_p: userSettings.llm_top_p,
        frequency_penalty: userSettings.llm_frequency_penalty,
        presence_penalty: userSettings.llm_presence_penalty
      });

      const generatedTags = response.content.trim();
      console.log('🤖 LLM generated tags:', generatedTags);

      // Validate and filter tags
      const validatedTags = this.validateTags(generatedTags);
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
  buildTagGenerationPrompt(conversationContext, contextualTags, currentStatus) {
    // Format current status info
    let statusInfo = 'Unknown';
    if (currentStatus) {
      statusInfo = currentStatus.status;
      if (currentStatus.activity) {
        statusInfo += ` (${currentStatus.activity})`;
      }
    }

    return `You are selecting Danbooru-style image tags for generating an image that matches the current conversation context.

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

Guidelines:
- Choose 5-10 tags that best match the conversation context AND current status
- **DEFAULT to "selfie" as photo type** (90% of the time - this is standard for dating app pics)
- **ALWAYS include a focus/composition tag** (close-up, upper body, breast focus, cowboy shot, etc.)
- Focus on: expression, pose, activity, clothing, location, lighting
- Match the location/activity to the character's current status (e.g., if at gym, use gym-related tags)
- Only use tags from the library above or the character-specific tags
- Output ONLY comma-separated tags, no explanations
- Be specific and contextual - avoid generic tags

Example output format:
upper body, selfie, smiling, casual clothes, bedroom, soft lighting, looking at viewer

Your selected tags:`;
  }

  /**
   * Validate generated tags against the tag library
   * @param {string} generatedTags - Comma-separated tags from LLM
   * @returns {string} Comma-separated validated tags
   */
  validateTags(generatedTags) {
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
      if (validTagsSet.has(normalizedTag)) {
        validTags.push(tag);
      } else {
        invalidTags.push(tag);
      }
    }

    if (invalidTags.length > 0) {
      console.log('⚠️  Discarded invalid tags:', invalidTags.join(', '));
    }

    return validTags.join(', ');
  }

  /**
   * Get recent messages from conversation (last 10)
   * @param {number} conversationId - Conversation ID
   * @param {object} db - Database instance
   * @returns {Array} Last 10 messages
   */
  getRecentMessages(conversationId, db) {
    const messages = db.prepare(`
      SELECT role, content
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(conversationId);

    // Reverse to get chronological order
    return messages.reverse();
  }
}

export default new ImageTagGenerationService();
