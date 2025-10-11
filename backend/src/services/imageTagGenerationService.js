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

      // Call LLM to generate tags using DeepSeek with reasoning enabled
      const response = await aiService.createBasicCompletion(prompt, {
        model: 'x-ai/grok-4-fast',
        temperature: 0.7, // Slightly creative but focused
        max_tokens: 5000, // Enough for reasoning + tags
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        reasoning_effort: 'low' // Low reasoning effort (~20% of tokens)
      });

      // Log full response to see reasoning output
      console.log('🧠 DeepSeek FULL RESPONSE:', JSON.stringify(response, null, 2));

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
  buildTagGenerationPrompt(conversationContext, contextualTags, currentStatus, previousImageTags) {
    // Format current status info
    let statusInfo = 'Unknown';
    if (currentStatus) {
      statusInfo = currentStatus.status;
      if (currentStatus.activity) {
        statusInfo += ` (${currentStatus.activity})`;
      }
    }

    // Build base prompt
    let prompt = `You are selecting Danbooru-style image tags for generating an image that matches the current conversation context.

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
- **CLOTHING MUST BE HIGHLY SPECIFIC** - This is critical!
  * ALWAYS add color + clothing type: "white t-shirt", "black tank top", "blue denim jacket", "red sundress"
  * Add style details: "off-shoulder white shirt", "tight black tank top", "oversized grey hoodie"
  * Add cut details: "cleavage_cutout", "midriff", "low-cut", "crop top", "v-neck"
  * NEVER use vague terms: "casual clothes", "outfit", "clothing", "dress" (too vague - specify color/style!)
  * Examples: "white crop top", "blue denim shorts", "black off-shoulder dress", "grey oversized hoodie", "red sports bra"
- Focus on: expression, pose, activity, clothing (COLOR + TYPE + DETAILS), location, lighting
- Match the location/activity to the character's current status (e.g., if at gym, use gym-related tags)
- Only use tags from the library above or the character-specific tags
- Output ONLY comma-separated tags, no explanations
- Be specific and contextual - avoid generic tags`;

    // Add previous image tags section if available for VISUAL CONSISTENCY
    if (previousImageTags && previousImageTags.length > 0) {
      prompt += `

---

⚠️ CRITICAL - PREVIOUS IMAGES IN THIS CONVERSATION:

${previousImageTags.map((tags, index) => `Image ${index + 1}: ${tags}`).join('\n')}

**MAINTAIN VISUAL CONSISTENCY - SAME CHARACTER, SAME OUTFIT**: These are images the character has ALREADY sent in this conversation.

MUST KEEP IDENTICAL:
- Hair (exact color, style, length)
- Outfit (exact same clothing items and colors - if previous image had "white crop top", use "white crop top")
- Body type
- Any visible accessories

CAN VARY:
- Expression (smiling, serious, playful, etc.)
- Pose (sitting, standing, lying down, etc.)
- Location (bedroom, park, gym, etc.)
- Lighting (soft lighting, natural light, etc.)
- Camera angle (close-up, upper body, full body, etc.)

Think of it like the same person taking multiple selfies in the same outfit - the outfit stays identical, only the pose/expression/location changes.`;
    }

    prompt += `

Example output format:
upper body, selfie, smiling, white crop top, denim shorts, bedroom, soft lighting, looking at viewer

Your selected tags:`;

    return prompt;
  }

  /**
   * Validate generated tags against the tag library
   * @param {string} generatedTags - Comma-separated tags from LLM
   * @returns {string} Comma-separated validated tags
   */
  validateTags(generatedTags) {
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
   * Get recent messages from conversation (last 10)
   * Also fetches image_tags from any previous image messages for consistency
   * @param {number} conversationId - Conversation ID
   * @param {object} db - Database instance
   * @returns {Array} Last 10 messages with image_tags if present
   */
  getRecentMessages(conversationId, db) {
    const messages = db.prepare(`
      SELECT role, content, image_tags, message_type
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
