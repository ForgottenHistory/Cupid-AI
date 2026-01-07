import aiService from '../services/aiService.js';
import personalityService from '../services/personalityService.js';
import characterAttributesService from '../services/characterAttributesService.js';
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

    const prompt = buildCleanupDescriptionPrompt(description, req.user.id);

    const response = await aiService.createBasicCompletion(prompt, {
      messageType: 'cleanup-description',
      userId: req.user.id,
      llmType: 'metadata'
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

    const prompt = buildDatingProfilePrompt(description, name, req.user.id);

    const response = await aiService.createBasicCompletion(prompt, {
      messageType: 'dating-profile',
      characterName: name || 'Character',
      userId: req.user.id,
      llmType: 'metadata'
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
 * Use AI to generate a realistic weekly schedule (or single day) from character description
 * Optional query param: ?day=MONDAY (generates only that day)
 */
export async function generateSchedule(req, res) {
  try {
    const { description, name, extraInstructions, attributes } = req.body;
    const { day } = req.query; // Optional: MONDAY, TUESDAY, etc.

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Validate day if provided
    const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    if (day && !validDays.includes(day.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid day. Must be one of: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY' });
    }

    const prompt = buildSchedulePrompt(description, name, day ? day.toUpperCase() : null, extraInstructions, req.user.id, attributes);

    const response = await aiService.createBasicCompletion(prompt, {
      messageType: day ? `schedule-${day.toLowerCase()}` : 'schedule',
      characterName: name || 'Character',
      userId: req.user.id,
      llmType: 'metadata',
      timeout: 300000 // 5 minute timeout for schedule generation
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

    const traits = await personalityService.generatePersonality(characterData, req.user.id);

    res.json({ personality: traits });
  } catch (error) {
    console.error('Generate personality error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate personality' });
  }
}

/**
 * POST /api/characters/generate-attributes
 * Generate character attributes based on configurable schema
 */
export async function generateAttributes(req, res) {
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

    const attributes = await characterAttributesService.generateAttributes(characterData, req.user.id);

    res.json({ attributes });
  } catch (error) {
    console.error('Generate attributes error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate attributes' });
  }
}

/**
 * GET /api/characters/attributes-schema
 * Get the attribute schema for the current user
 */
export async function getAttributesSchema(req, res) {
  try {
    const schema = characterAttributesService.loadAttributeSchema(req.user.id);
    res.json(schema);
  } catch (error) {
    console.error('Get attributes schema error:', error);
    res.status(500).json({ error: error.message || 'Failed to get attributes schema' });
  }
}

/**
 * PUT /api/characters/attributes-schema
 * Save custom attribute schema for the current user
 */
export async function saveAttributesSchema(req, res) {
  try {
    const { attributes } = req.body;

    if (!Array.isArray(attributes)) {
      return res.status(400).json({ error: 'attributes must be an array' });
    }

    const schema = { attributes };
    const success = characterAttributesService.saveAttributeSchema(req.user.id, schema);

    if (success) {
      res.json({ success: true, schema });
    } else {
      res.status(500).json({ error: 'Failed to save schema' });
    }
  } catch (error) {
    console.error('Save attributes schema error:', error);
    res.status(500).json({ error: error.message || 'Failed to save attributes schema' });
  }
}
