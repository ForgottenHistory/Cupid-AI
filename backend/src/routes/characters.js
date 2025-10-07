import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import aiService from '../services/aiService.js';
import db from '../db/database.js';

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
9. ALL NSFW details should be kept

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

/**
 * Parse plaintext schedule into JSON format
 */
function parseScheduleFromPlaintext(text) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const schedule = {};

  // Split by day headers
  const dayRegex = /(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)/gi;
  const sections = text.split(dayRegex).filter(s => s.trim());

  for (let i = 0; i < sections.length; i += 2) {
    const dayName = sections[i].toLowerCase();
    const dayContent = sections[i + 1];

    if (!days.includes(dayName) || !dayContent) continue;

    const blocks = [];
    const lines = dayContent.trim().split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Parse format: "HH:MM-HH:MM STATUS Activity (optional)"
      const match = trimmedLine.match(/(\d{2}:\d{2})-(\d{2}:\d{2})\s+(ONLINE|AWAY|BUSY|OFFLINE)(?:\s+(.+))?/i);
      if (match) {
        const [, start, end, status, activity] = match;
        const block = {
          start,
          end,
          status: status.toLowerCase()
        };
        if (activity) {
          block.activity = activity.trim();
        }
        blocks.push(block);
      }
    }

    if (blocks.length > 0) {
      schedule[dayName] = blocks;
    }
  }

  return {
    schedule,
    responseDelays: {
      online: [30, 120],
      away: [300, 1200],
      busy: [900, 3600],
      offline: null
    }
  };
}

/**
 * POST /api/characters/generate-schedule
 * Use AI to generate a realistic weekly schedule from character description
 */
router.post('/generate-schedule', authenticateToken, async (req, res) => {
  try {
    const { description, name } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const characterName = name || 'this character';

    const messages = [
      {
        role: 'user',
        content: `Based on the character description below, create a realistic weekly schedule for ${characterName}.

Status meanings:
- ONLINE: Free and available to chat
- AWAY: Busy with activities but might check phone
- BUSY: At work or important tasks
- OFFLINE: Sleeping or unavailable

Character Description:
${description}

Create a schedule in this simple format (one line per time block):

MONDAY
00:00-08:00 OFFLINE Sleep
08:00-09:00 AWAY Morning routine
09:00-17:00 BUSY Work
17:00-19:00 ONLINE
19:00-21:00 AWAY Gym
21:00-24:00 ONLINE

TUESDAY
...

Continue for all 7 days. Make it realistic for this character's lifestyle and personality. Activities are optional for ONLINE periods.`
      }
    ];

    const response = await aiService.createChatCompletion({
      messages,
      characterData: { name: 'Assistant' },
      userId: req.user.id,
      model: null,
      maxTokens: 1500,
    });

    // Parse plaintext response into JSON
    const content = response.content.trim();
    const scheduleData = parseScheduleFromPlaintext(content);

    res.json({ schedule: scheduleData });
  } catch (error) {
    console.error('Generate schedule error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate schedule' });
  }
});

/**
 * Calculate current status from schedule
 */
function calculateCurrentStatus(schedule) {
  if (!schedule?.schedule) {
    return { status: 'online', activity: null, nextChange: null };
  }

  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const todaySchedule = schedule.schedule[currentDay];
  if (!todaySchedule || todaySchedule.length === 0) {
    return { status: 'offline', activity: null, nextChange: null };
  }

  // Find the block that contains current time
  for (const block of todaySchedule) {
    if (currentTime >= block.start && currentTime < block.end) {
      return {
        status: block.status,
        activity: block.activity || null,
        nextChange: block.end
      };
    }
  }

  // If no block found, assume offline
  return { status: 'offline', activity: null, nextChange: null };
}

/**
 * GET /api/characters/:characterId/status
 * Get current status for a character based on their schedule
 */
router.get('/:characterId/status', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    // Get character from database
    const character = db.prepare(`
      SELECT * FROM characters
      WHERE id = ? AND user_id = ?
    `).get(characterId, userId);

    if (!character) {
      console.log(`Character ${characterId} not found in backend for user ${userId}`);
      // Return default online status instead of error
      return res.json({ status: 'online', activity: null, nextChange: null });
    }

    // Parse schedule if it exists
    let schedule = null;
    if (character.schedule_data) {
      try {
        schedule = JSON.parse(character.schedule_data);
      } catch (parseError) {
        console.error('Failed to parse schedule:', parseError);
      }
    }

    // Calculate current status
    const statusInfo = calculateCurrentStatus(schedule);
    res.json(statusInfo);
  } catch (error) {
    console.error('Get character status error:', {
      message: error.message,
      stack: error.stack,
      characterId: req.params.characterId
    });
    res.status(500).json({ error: error.message || 'Failed to get character status' });
  }
});

/**
 * POST /api/characters/:characterId/status
 * Calculate current status from character's schedule
 */
router.post('/:characterId/status', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    const { schedule } = req.body;

    if (!schedule) {
      return res.json({ status: 'online', activity: null, nextChange: null });
    }

    const statusInfo = calculateCurrentStatus(schedule);
    res.json(statusInfo);
  } catch (error) {
    console.error('Calculate status error:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate status' });
  }
});

/**
 * GET /api/characters/:characterId/engagement
 * Get engagement state for a character
 */
router.get('/:characterId/engagement', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    const engagementState = db.prepare(`
      SELECT engagement_state FROM character_states
      WHERE user_id = ? AND character_id = ?
    `).get(userId, characterId);

    res.json({
      isEngaged: engagementState?.engagement_state === 'engaged'
    });
  } catch (error) {
    console.error('Get engagement state error:', error);
    res.status(500).json({ error: error.message || 'Failed to get engagement state' });
  }
});

export default router;
