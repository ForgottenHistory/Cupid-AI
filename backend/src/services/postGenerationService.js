import db from '../db/database.js';
import aiService from './aiService.js';
import { getCurrentStatusFromSchedule } from '../utils/chatHelpers.js';

class PostGenerationService {

  /**
   * Select characters to post based on personality weights
   * Returns array of character objects with their posting weight
   */
  selectCharactersToPost(slotsAvailable) {
    // Get all characters
    const characters = db.prepare(`
      SELECT * FROM characters
      WHERE card_data IS NOT NULL
    `).all();

    const candidates = [];

    for (const character of characters) {
      try {
        // Parse character data
        const characterData = JSON.parse(character.card_data);

        // Parse schedule
        const schedule = character.schedule_data ? JSON.parse(character.schedule_data) : null;

        // Check if character is currently online or away (can post)
        if (schedule) {
          const statusInfo = getCurrentStatusFromSchedule(schedule);
          if (statusInfo.status === 'offline' || statusInfo.status === 'busy') {
            continue; // Skip offline/busy characters
          }
        }

        // Parse personality data
        let personality = null;
        if (character.personality_data) {
          try {
            personality = JSON.parse(character.personality_data);
          } catch (error) {
            console.error('Failed to parse personality data:', error);
          }
        }

        // Calculate posting weight based on personality
        // High extraversion + openness = more likely to post
        const extraversion = personality?.extraversion || 50;
        const openness = personality?.openness || 50;
        const weight = (extraversion + openness) / 2;

        candidates.push({
          character,
          characterData,
          personality,
          weight
        });
      } catch (error) {
        console.error('Failed to parse character data:', error);
        continue;
      }
    }

    // Sort by weight (highest first) and add random factor
    candidates.sort((a, b) => {
      const aScore = a.weight + Math.random() * 20; // Add randomness
      const bScore = b.weight + Math.random() * 20;
      return bScore - aScore;
    });

    // Return top N candidates
    return candidates.slice(0, slotsAvailable);
  }

  /**
   * Generate a post for a character
   */
  async generatePost(candidate) {
    try {
      const { character, characterData, personality } = candidate;

      console.log(`📝 Generating post for ${characterData.name}...`);

      // Build prompt for post generation
      const prompt = `You are ${characterData.name}.

Character Description:
${characterData.description || characterData.personality || ''}

You're posting an update on a dating app feed to show your personality and what you're up to. Write a short, casual post in first person (1-3 sentences) about something interesting, funny, or relevant to your life right now.

Guidelines:
- Be authentic and show your personality
- Share something relatable or intriguing that might catch someone's attention
- Keep it casual and conversational
- Don't use excessive hashtags or emojis
- Make people want to DM you

IMPORTANT: Write ONLY the post text itself. No quotation marks, no "Here's my post:", no extra formatting. Just the raw text.`;


      // Call Content LLM to generate post
      const response = await aiService.createBasicCompletion(prompt, {
        temperature: 0.9,
        max_tokens: 200
      });

      // Clean up the response - remove quotes and extra formatting
      let postContent = response.content.trim();

      // Remove surrounding quotes if present
      if ((postContent.startsWith('"') && postContent.endsWith('"')) ||
          (postContent.startsWith("'") && postContent.endsWith("'"))) {
        postContent = postContent.slice(1, -1).trim();
      }

      // Remove any "Here's my post:" or similar prefixes
      postContent = postContent.replace(/^(Here's my post:|Post:|Tweet:)\s*/i, '');

      // Decide if this should be an image post (10% chance)
      const shouldGenerateImage = Math.random() < 0.1;
      let imageUrl = null;

      if (shouldGenerateImage && character.image_tags) {
        console.log(`🖼️ Generating image for ${characterData.name}'s post...`);
        // TODO: Generate SD image (Phase 1: skip for now, just text posts)
        // For now, we'll just create text posts
      }

      // Determine post type
      const postType = imageUrl ? 'text_image' : 'text';

      // Save post to database
      const stmt = db.prepare(`
        INSERT INTO posts (character_id, content, image_url, post_type, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      const result = stmt.run(character.id, postContent, imageUrl, postType);

      console.log(`✅ Generated post for ${characterData.name}: "${postContent.substring(0, 50)}..."`);

      return {
        id: result.lastInsertRowid,
        character_id: character.id,
        content: postContent,
        image_url: imageUrl,
        post_type: postType
      };
    } catch (error) {
      console.error('Failed to generate post:', error);
      return null;
    }
  }

  /**
   * Run the post generation service
   * Called periodically by interval in server.js (every 60 minutes)
   * Generates 1 post per run
   */
  async generatePosts() {
    try {
      console.log('🔍 Running post generation (1 post/hour)...');

      // Select one character to post
      const selectedCharacters = this.selectCharactersToPost(1);

      if (selectedCharacters.length === 0) {
        console.log('⏸️ No characters available to post');
        return;
      }

      // Generate post
      const post = await this.generatePost(selectedCharacters[0]);

      if (post) {
        console.log(`✅ Successfully generated post`);
      } else {
        console.log('❌ Failed to generate post');
      }
    } catch (error) {
      console.error('Post generation error:', error);
    }
  }
}

export default new PostGenerationService();
