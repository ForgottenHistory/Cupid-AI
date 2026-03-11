import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import aiService from '../services/aiService.js';
import db from '../db/database.js';
import conversationService from '../services/conversationService.js';
import messageService from '../services/messageService.js';
import messageProcessor from '../services/messageProcessor.js';
import { getCurrentStatusFromSchedule } from '../utils/chatHelpers.js';

const router = express.Router();

// Activity conversation expiry time (30 minutes from start)
const ACTIVITY_EXPIRY_MINUTES = 30;

// Cleanup expired activity conversations every 5 minutes
setInterval(() => {
  try {
    const now = new Date().toISOString();

    // Find and delete expired activity conversations
    const expired = db.prepare(`
      SELECT id FROM conversations
      WHERE activity_expires_at IS NOT NULL
      AND activity_expires_at < ?
    `).all(now);

    if (expired.length > 0) {
      for (const conv of expired) {
        // Delete messages first (foreign key constraint)
        db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conv.id);
        // Delete conversation
        db.prepare('DELETE FROM conversations WHERE id = ?').run(conv.id);
      }
      console.log(`🧹 Cleaned up ${expired.length} expired activity conversation(s)`);
    }
  } catch (error) {
    console.error('Activity cleanup error:', error);
  }
}, 5 * 60 * 1000);

/**
 * POST /api/random-chat/start
 * Start a new activity session - creates a temporary conversation
 */
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { characterId, mode = 'random' } = req.body;
    const userId = req.user.id;

    if (!characterId) {
      return res.status(400).json({ error: 'Character ID is required' });
    }

    // Get character data
    const character = db.prepare(`
      SELECT id, name, card_data, image_url, schedule_data
      FROM characters
      WHERE id = ?
    `).get(characterId);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    let cardData = {};
    try {
      cardData = JSON.parse(character.card_data || '{}');
    } catch (e) {
      console.error('Failed to parse card_data:', e);
    }

    const characterName = cardData.data?.name || cardData.name || character.name || 'Character';

    // Get user's chat duration setting
    const userSettings = db.prepare(
      'SELECT activities_chat_duration FROM users WHERE id = ?'
    ).get(userId);
    const chatDuration = userSettings?.activities_chat_duration || 10;

    // Calculate expiry time (chat duration + buffer)
    const now = new Date();
    const startedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + ACTIVITY_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Check if there's already an active activity conversation with this character
    const existing = db.prepare(`
      SELECT id FROM conversations
      WHERE user_id = ? AND character_id = ? AND activity_expires_at IS NOT NULL
    `).get(userId, characterId);

    if (existing) {
      // Delete the old one
      db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(existing.id);
      db.prepare('DELETE FROM conversations WHERE id = ?').run(existing.id);
    }

    // Create temporary conversation
    const result = db.prepare(`
      INSERT INTO conversations (user_id, character_id, character_name, activity_expires_at, activity_mode, activity_started_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, characterId, characterName, expiresAt, mode, startedAt);

    const conversationId = result.lastInsertRowid;

    const modeLabel = mode === 'blind' ? 'Blind date' : 'Random chat';
    console.log(`🎲 ${modeLabel} started: conversation ${conversationId} with ${characterName}`);

    res.json({
      conversationId,
      characterId,
      characterName,
      mode,
      chatDuration,
      startedAt,
      expiresAt,
    });

  } catch (error) {
    console.error('Start activity error:', error);
    res.status(500).json({ error: error.message || 'Failed to start activity' });
  }
});

/**
 * POST /api/random-chat/decide
 * Submit decision and get character's decision
 */
router.post('/decide', authenticateToken, async (req, res) => {
  try {
    const { conversationId, userDecision } = req.body;
    const userId = req.user.id;

    if (!conversationId || !userDecision) {
      return res.status(400).json({ error: 'Conversation ID and decision are required' });
    }

    if (userDecision !== 'yes' && userDecision !== 'no') {
      return res.status(400).json({ error: 'Decision must be "yes" or "no"' });
    }

    // Get conversation
    const conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE id = ? AND user_id = ? AND activity_expires_at IS NOT NULL
    `).get(conversationId, userId);

    if (!conversation) {
      return res.status(404).json({ error: 'Activity conversation not found' });
    }

    // Get character data
    const character = db.prepare(`
      SELECT id, name, card_data FROM characters WHERE id = ?
    `).get(conversation.character_id);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    let cardData = {};
    try {
      cardData = JSON.parse(character.card_data || '{}');
    } catch (e) {}

    const characterName = cardData.data?.name || cardData.name || character.name || 'Character';

    // Get messages for decision
    const messages = messageService.getMessages(conversationId);

    // Generate character's decision
    const result = await generateCharacterDecision(messages, characterName, cardData, userId);

    console.log(`🎲 Activity decision: User=${userDecision}, Character=${result.decision}`);

    const isMatch = userDecision === 'yes' && result.decision === 'yes';

    res.json({
      userDecision,
      characterDecision: result.decision,
      characterReason: result.reason,
      isMatch
    });

  } catch (error) {
    console.error('Activity decide error:', error);
    res.status(500).json({ error: error.message || 'Failed to process decision' });
  }
});

/**
 * POST /api/random-chat/confirm
 * Confirm a match - converts temporary conversation to permanent
 */
router.post('/confirm', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user.id;

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    // Get conversation
    const conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE id = ? AND user_id = ? AND activity_expires_at IS NOT NULL
    `).get(conversationId, userId);

    if (!conversation) {
      return res.status(404).json({ error: 'Activity conversation not found' });
    }

    // Add system message about the match
    const modeLabel = conversation.activity_mode === 'blind' ? 'blind date' : 'random chat';
    messageService.saveMessage(
      conversationId,
      'system',
      `[ACTIVITY MATCH: You matched through ${modeLabel}!]`,
      null,
      'system'
    );

    // Convert to permanent by removing activity fields
    db.prepare(`
      UPDATE conversations
      SET activity_expires_at = NULL, activity_mode = NULL, activity_started_at = NULL, unread_count = 0
      WHERE id = ?
    `).run(conversationId);

    console.log(`🎲 Activity confirmed as match: conversation ${conversationId}`);

    res.json({ success: true });

  } catch (error) {
    console.error('Activity confirm error:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm match' });
  }
});

/**
 * POST /api/random-chat/abandon
 * Abandon activity - deletes the temporary conversation
 */
router.post('/abandon', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user.id;

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    // Get conversation to verify ownership and that it's an activity
    const conversation = db.prepare(`
      SELECT id FROM conversations
      WHERE id = ? AND user_id = ? AND activity_expires_at IS NOT NULL
    `).get(conversationId, userId);

    if (!conversation) {
      // Already deleted or not found - that's fine
      return res.json({ success: true });
    }

    // Delete messages and conversation
    db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId);
    db.prepare('DELETE FROM conversations WHERE id = ?').run(conversationId);

    console.log(`🎲 Activity abandoned: conversation ${conversationId}`);

    res.json({ success: true });

  } catch (error) {
    console.error('Activity abandon error:', error);
    res.status(500).json({ error: error.message || 'Failed to abandon activity' });
  }
});

/**
 * Generate character's decision based on conversation quality
 */
async function generateCharacterDecision(messages, characterName, cardData, userId) {
  // Filter to just user/assistant messages
  const chatMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');

  // If no messages were exchanged, character says no
  if (chatMessages.length === 0) {
    return { decision: 'no', reason: 'No conversation took place' };
  }

  // Get user's display name
  const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
  const userName = user?.display_name || 'User';

  // Build conversation summary for decision
  const conversationText = chatMessages
    .map(m => `${m.role === 'user' ? userName : characterName}: ${m.content}`)
    .join('\n');

  const decisionPrompt = `You are ${characterName}. You just finished a random chat with ${userName}. Based on the conversation below, decide if you want to match with them.

CONVERSATION:
${conversationText}

Consider:
- Did they seem genuinely interested in getting to know you?
- Was the conversation engaging and fun?
- Did you feel a connection or chemistry?
- Were they respectful and interesting?
- Would you want to continue talking to them?

Be honest based on your personality. Not every conversation leads to a match - it's okay to say no if there wasn't a spark.

Respond in this exact YAML format:
decision: yes or no
reason: brief explanation (1 sentence)`;

  try {
    const response = await aiService.createBasicCompletion(decisionPrompt, {
      max_tokens: 100,
      userId: userId,
      llmType: 'decision',
      messageType: 'activity-decision',
      characterName: characterName,
      userName: userName
    });

    const content = response.content.trim();

    // Parse YAML-style response
    const decisionMatch = content.match(/decision:\s*(yes|no)/i);
    const reasonMatch = content.match(/reason:\s*(.+)/i);

    const decision = decisionMatch ? decisionMatch[1].toLowerCase() : null;
    const reason = reasonMatch ? reasonMatch[1].trim() : null;

    if (reason) {
      console.log(`🎲 ${characterName}'s reason: ${reason}`);
    }

    if (decision === 'yes' || decision === 'no') {
      return { decision, reason };
    }

    // Fallback: check if content contains yes/no
    if (content.toLowerCase().includes('yes')) return { decision: 'yes', reason };
    if (content.toLowerCase().includes('no')) return { decision: 'no', reason };

    // Default based on conversation length
    return { decision: chatMessages.length >= 6 ? 'yes' : 'no', reason: null };

  } catch (error) {
    console.error('Failed to generate character decision:', error);
    return { decision: chatMessages.length >= 6 ? 'yes' : 'no', reason: null };
  }
}

/**
 * POST /api/random-chat/icebreaker-question
 * Generate an icebreaker question from a character
 */
router.post('/icebreaker-question', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.body;
    const userId = req.user.id;

    if (!characterId) {
      return res.status(400).json({ error: 'Character ID is required' });
    }

    // Get character data
    const character = db.prepare(`
      SELECT id, name, card_data, image_url, schedule_data
      FROM characters
      WHERE id = ?
    `).get(characterId);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    let cardData = {};
    try {
      cardData = JSON.parse(character.card_data || '{}');
    } catch (e) {
      console.error('Failed to parse card_data:', e);
    }

    const characterName = cardData.data?.name || cardData.name || character.name || 'Character';
    const description = cardData.data?.description || cardData.description || '';

    // Get character's current activity from schedule
    let activityContext = '';
    if (character.schedule_data) {
      try {
        const schedule = JSON.parse(character.schedule_data);
        const { status, activity } = getCurrentStatusFromSchedule(schedule);
        if (activity) {
          activityContext = `\nYou are currently ${status} (${activity}).`;
        } else {
          activityContext = `\nYou are currently ${status}.`;
        }
      } catch (e) {}
    }

    // Get user's display name
    const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
    const userName = user?.display_name || 'User';

    // Randomize question style
    const questionStyles = [
      'fun and lighthearted',
      'flirty and playful',
      'deep and thought-provoking',
      'silly and random',
      'witty and clever',
      'nostalgic (about memories or childhood)',
      'hypothetical (a "what if" or "would you rather" scenario)',
      'creative and imaginative',
      'bold and direct',
      'sweet and genuine',
    ];
    const style = questionStyles[Math.floor(Math.random() * questionStyles.length)];

    const prompt = `You are ${characterName}. You're on a dating app and want to ask someone an icebreaker question to get to know them. The question should reflect your personality.

Character description: ${description}${activityContext}

Write a single ${style} icebreaker question. Keep it under 2 sentences. Don't include any preamble - just the question itself.`;

    const response = await aiService.createBasicCompletion(prompt, {
      max_tokens: 150,
      userId,
      llmType: 'content',
      messageType: 'icebreaker-question',
      characterName,
      userName
    });

    res.json({
      question: response.content.trim(),
      characterId,
      characterName
    });

  } catch (error) {
    console.error('Icebreaker question error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate icebreaker question' });
  }
});

/**
 * POST /api/random-chat/icebreaker-answer
 * Submit answer to icebreaker and create a match
 */
router.post('/icebreaker-answer', authenticateToken, async (req, res) => {
  try {
    const { characterId, question, answer } = req.body;
    const userId = req.user.id;

    if (!characterId || !question || !answer) {
      return res.status(400).json({ error: 'characterId, question, and answer are all required' });
    }

    // Get character data
    const character = db.prepare(`
      SELECT id, name, card_data
      FROM characters
      WHERE id = ?
    `).get(characterId);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    let cardData = {};
    try {
      cardData = JSON.parse(character.card_data || '{}');
    } catch (e) {
      console.error('Failed to parse card_data:', e);
    }

    const characterName = cardData.data?.name || cardData.name || character.name || 'Character';

    // Like the character
    db.prepare('UPDATE characters SET is_liked = 1 WHERE id = ? AND user_id = ?').run(characterId, userId);

    // Check for existing permanent conversation
    let conversationId;
    const existing = db.prepare(`
      SELECT id FROM conversations
      WHERE user_id = ? AND character_id = ? AND activity_expires_at IS NULL
    `).get(userId, characterId);

    if (existing) {
      conversationId = existing.id;
    } else {
      const result = db.prepare(`
        INSERT INTO conversations (user_id, character_id, character_name)
        VALUES (?, ?, ?)
      `).run(userId, characterId, characterName);
      conversationId = result.lastInsertRowid;
    }

    // Save system message
    messageService.saveMessage(conversationId, 'system', '[ACTIVITY MATCH: You matched through icebreaker!]', null, 'system');

    // Save the character's question as an assistant message
    messageService.saveMessage(conversationId, 'assistant', question);

    // Save the user's answer as a user message
    messageService.saveMessage(conversationId, 'user', answer);

    res.json({
      success: true,
      conversationId,
      characterId
    });

    // Trigger AI response to the user's answer asynchronously
    const io = req.app.get('io');
    const characterData = cardData.data || cardData;
    messageProcessor.processMessage(io, userId, characterId, conversationId, characterData).catch(error => {
      console.error('Icebreaker AI response error:', error);
    });

  } catch (error) {
    console.error('Icebreaker answer error:', error);
    res.status(500).json({ error: error.message || 'Failed to process icebreaker answer' });
  }
});

export default router;
