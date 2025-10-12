import aiService from '../services/aiService.js';
import { buildCleanupDescriptionPrompt, buildDatingProfilePrompt, buildSchedulePrompt } from '../prompts/characterPrompts.js';
import { parseDatingProfileResponse, parseScheduleFromPlaintext } from '../parsers/characterParsers.js';

/**
 * POST /api/characters/cleanup-description
 * Use AI to clean up character description (remove formatting, make plaintext)
 */
export async function cleanupDescription(req, res) {
  try {
    const { description } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const prompt = buildCleanupDescriptionPrompt(description);

    const response = await aiService.createBasicCompletion(prompt, {
      temperature: 0.7,
      max_tokens: 4000,
      messageType: 'cleanup-description',
      userId: req.user.id
    });

    res.json({ cleanedDescription: response.content.trim() });
  } catch (error) {
    console.error('Cleanup description error:', error);
    res.status(500).json({ error: error.message || 'Failed to cleanup description' });
  }
}

/**
 * POST /api/characters/generate-dating-profile
 * Use AI to generate a complete dating profile from character description
 */
export async function generateDatingProfile(req, res) {
  try {
    const { description, name } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const prompt = buildDatingProfilePrompt(description, name);

    const response = await aiService.createBasicCompletion(prompt, {
      temperature: 0.8,
      max_tokens: 3000,
      messageType: 'dating-profile',
      characterName: name || 'Character',
      userId: req.user.id
    });

    // Parse plaintext response
    const content = response.content.trim();
    const profileData = parseDatingProfileResponse(content);

    res.json({ profile: profileData });
  } catch (error) {
    console.error('Generate dating profile error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate dating profile' });
  }
}

/**
 * POST /api/characters/generate-schedule
 * Use AI to generate a realistic weekly schedule from character description
 */
export async function generateSchedule(req, res) {
  try {
    const { description, name } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const prompt = buildSchedulePrompt(description, name);

    const response = await aiService.createBasicCompletion(prompt, {
      temperature: 0.7,
      max_tokens: 4000,
      messageType: 'schedule',
      characterName: name || 'Character',
      userId: req.user.id
    });

    // Parse plaintext response into JSON
    const content = response.content.trim();
    const scheduleData = parseScheduleFromPlaintext(content);

    res.json({ schedule: scheduleData });
  } catch (error) {
    console.error('Generate schedule error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate schedule' });
  }
}

/**
 * POST /api/characters/generate-personality
 * Generate Big Five personality traits for a character
 */
export async function generatePersonality(req, res) {
  try {
    const { description, name, personality } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const characterData = {
      name: name || 'Character',
      description: description,
      personality: personality || ''
    };

    const traits = await aiService.generatePersonality(characterData, req.user.id);

    res.json({ personality: traits });
  } catch (error) {
    console.error('Generate personality error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate personality' });
  }
}
