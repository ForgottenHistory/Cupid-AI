import db from '../db/database.js';
import aiService from './aiService.js';
import { getCurrentStatusFromSchedule } from '../utils/chatHelpers.js';

class PostGenerationService {

  /**
   * Get current post count for today
   */
  getTodayPostCount() {
    const today = new Date().toISOString().split('T')[0];

    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM posts
      WHERE character_id IS NOT NULL
      AND DATE(created_at) = ?
    `).get(today);

    return result.count;
  }

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

Generate a short social media post (like Twitter/X). This is a post YOU are making to share with your followers. Write 1-3 sentences about something interesting, funny, or relevant to your character.

Guidelines:
- Write in first person (you are posting this yourself)
- Stay true to your character's personality and interests
- Keep it casual and social media appropriate
- Don't use hashtags or emojis excessively
- Make it feel natural and authentic

Write just the post text, nothing else.`;

      // Call Content LLM to generate post
      const response = await aiService.createBasicCompletion(prompt, {
        temperature: 0.9,
        max_tokens: 200
      });

      const postContent = response.content.trim();

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
   * Called periodically by interval in server.js
   */
  async generatePosts() {
    try {
      console.log('🔍 Checking post generation...');

      const DAILY_POST_LIMIT = 10;
      const currentCount = this.getTodayPostCount();

      console.log(`📊 Posts today: ${currentCount}/${DAILY_POST_LIMIT}`);

      if (currentCount >= DAILY_POST_LIMIT) {
        console.log('⏸️ Daily post limit reached, skipping generation');
        return;
      }

      // Calculate how many posts we can generate
      const slotsAvailable = DAILY_POST_LIMIT - currentCount;

      // For each run, generate 1-2 posts max (spread them out over the day)
      const postsToGenerate = Math.min(slotsAvailable, Math.floor(Math.random() * 2) + 1);

      console.log(`🎯 Generating ${postsToGenerate} post(s)...`);

      // Select characters to post
      const selectedCharacters = this.selectCharactersToPost(postsToGenerate);

      // Generate posts
      let generated = 0;
      for (const candidate of selectedCharacters) {
        const post = await this.generatePost(candidate);
        if (post) {
          generated++;
        }
      }

      console.log(`✅ Successfully generated ${generated} post(s)`);
    } catch (error) {
      console.error('Post generation error:', error);
    }
  }
}

export default new PostGenerationService();
