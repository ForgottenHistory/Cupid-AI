import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import aiService from '../services/aiService.js';

const router = express.Router();

/**
 * POST /api/characters/cleanup-description
 * Use AI to clean up character description (remove formatting, make plaintext)
 */
router.post('/cleanup-description', authenticateToken, async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const messages = [
      {
        role: 'user',
        content: `Convert this character description into clean, readable plaintext.

IMPORTANT RULES:
1. Remove any markdown, special formatting, asterisks, brackets, or role-play notation
2. Remove ANY references to romantic or sexual relationships with {{user}}, {{char}}, or similar placeholders (e.g., "your girlfriend", "your lover", "in love with you")
3. Remove hints at existing romantic connections or pre-established relationships with the reader
4. Friendships and platonic relationships are fine to keep
5. Keep personality traits, hobbies, background, and general character information
6. Keep it natural and descriptive
7. Try to keep the same style of writing
8. Include bodily details

Just return the cleaned text, nothing else:\n\n${description}`
      }
    ];

    const response = await aiService.createChatCompletion({
      messages,
      characterData: { name: 'Assistant' }, // Minimal character data
      userId: req.user.id,
    });

    res.json({ cleanedDescription: response.content.trim() });
  } catch (error) {
    console.error('Cleanup description error:', error);
    res.status(500).json({ error: error.message || 'Failed to cleanup description' });
  }
});

/**
 * POST /api/characters/generate-dating-profile
 * Use AI to generate a complete dating profile from character description
 */
router.post('/generate-dating-profile', authenticateToken, async (req, res) => {
  try {
    const { description, name } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const characterName = name || 'the character';

    const messages = [
      {
        role: 'user',
        content: `You are ${characterName}. Based on your character description below, create a dating profile AS IF YOU ARE WRITING IT YOURSELF. Write everything in first-person perspective.

Character Description:
${description}

Generate a JSON response with the following fields (all in first-person, as if ${characterName} is writing their own profile):

{
  "bio": "A 2-3 sentence 'About Me' section in first person. Make it natural and engaging, like a real dating profile.",
  "interests": ["interest1", "interest2", "interest3", "interest4", "interest5"],
  "funFacts": ["fun fact 1 in first person", "fun fact 2 in first person", "fun fact 3 in first person"],
  "age": <determine age from character description or make a reasonable estimate based on their personality and background>,
  "occupation": "optional occupation if clear from description, otherwise null",
  "lookingFor": "1-2 sentences about what I'm looking for in first person, or null if not applicable"
}

Important:
- Write EVERYTHING in first-person (I, me, my)
- Make it sound natural, like ${characterName} is actually writing their profile
- Be creative but stay true to the character description
- Only return valid JSON, no other text`
      }
    ];

    const response = await aiService.createChatCompletion({
      messages,
      characterData: { name: 'Assistant' },
      userId: req.user.id,
    });

    // Parse JSON response
    const content = response.content.trim();
    let profileData;

    try {
      // Try to extract JSON if there's extra text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        profileData = JSON.parse(jsonMatch[0]);
      } else {
        profileData = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('Failed to parse JSON:', content);
      throw new Error('AI returned invalid JSON format');
    }

    res.json({ profile: profileData });
  } catch (error) {
    console.error('Generate dating profile error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate dating profile' });
  }
});

export default router;
