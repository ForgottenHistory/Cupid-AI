import express from 'express';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.js';
import aiService from '../services/aiService.js';
import db from '../db/database.js';
import { loadPrompts } from './prompts.js';

const router = express.Router();

// In-memory session storage (could be moved to database for persistence)
const sessions = new Map();

// Session cleanup - remove sessions older than 1 hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [sessionId, session] of sessions.entries()) {
    if (session.createdAt < oneHourAgo) {
      sessions.delete(sessionId);
      console.log(`🧹 Cleaned up expired random chat session: ${sessionId}`);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

/**
 * Get character data from database
 */
function getCharacterData(characterId) {
  const character = db.prepare(`
    SELECT id, name, card_data, image_url, schedule_data
    FROM characters
    WHERE id = ?
  `).get(characterId);

  if (!character) return null;

  let cardData = {};
  try {
    cardData = JSON.parse(character.card_data || '{}');
  } catch (e) {
    console.error('Failed to parse card_data:', e);
  }

  let scheduleData = null;
  try {
    scheduleData = character.schedule_data ? JSON.parse(character.schedule_data) : null;
  } catch (e) {
    console.error('Failed to parse schedule_data:', e);
  }

  return {
    id: character.id,
    name: cardData.data?.name || cardData.name || character.name || 'Character',
    cardData,
    imageUrl: character.image_url,
    schedule: scheduleData
  };
}

/**
 * Build system prompt for random chat
 */
function buildRandomChatSystemPrompt(characterData, userId) {
  const prompts = loadPrompts(userId);
  const characterName = characterData.name;
  const description = characterData.cardData?.data?.description || characterData.cardData?.description || '';

  // Use a simplified version of the system prompt for random chat
  // Focus on being natural and not knowing each other yet
  let systemPrompt = `You are ${characterName}. You're in a random chat - you don't know this person yet and they don't know you.

CHARACTER DESCRIPTION:
${description}

RANDOM CHAT RULES:
- This is a blind chat - you're meeting for the first time
- Be yourself, but remember you're talking to a stranger
- You have 10 minutes to chat before deciding if you want to match
- Be natural, engaging, and show your personality
- Don't be too eager or too distant - feel them out
- Ask questions to get to know them
- Share a bit about yourself when appropriate

${prompts.systemPrompt ? `\nADDITIONAL STYLE GUIDANCE:\n${prompts.systemPrompt}` : ''}

Keep responses conversational and natural. No roleplay formatting (no asterisks, no quotes for actions).`;

  return systemPrompt;
}

/**
 * POST /api/random-chat/start
 * Start a new random chat session
 */
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.body;
    const userId = req.user.id;

    if (!characterId) {
      return res.status(400).json({ error: 'Character ID is required' });
    }

    // Get character data
    const characterData = getCharacterData(characterId);
    if (!characterData) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const session = {
      sessionId,
      userId,
      characterId,
      characterData,
      messages: [],
      createdAt: Date.now(),
      decided: false
    };

    sessions.set(sessionId, session);

    console.log(`🎲 Random chat started: ${sessionId} with ${characterData.name}`);

    res.json({
      sessionId,
      characterName: characterData.name
    });

  } catch (error) {
    console.error('Start random chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to start random chat' });
  }
});

/**
 * POST /api/random-chat/message
 * Send a message in random chat
 */
router.post('/message', authenticateToken, async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    const userId = req.user.id;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Session ID and message are required' });
    }

    // Get session
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (session.decided) {
      return res.status(400).json({ error: 'Session has ended' });
    }

    // Add user message to session
    session.messages.push({
      role: 'user',
      content: message
    });

    // Build messages for AI
    const systemPrompt = buildRandomChatSystemPrompt(session.characterData, userId);
    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...session.messages
    ];

    // Generate AI response
    const aiResponse = await aiService.createChatCompletion({
      messages: aiMessages,
      characterData: session.characterData.cardData,
      userId: userId,
      maxTokens: 500
    });

    // Clean response
    let responseContent = aiResponse.content || '';
    // Remove em dashes
    responseContent = responseContent.replace(/—\s*(.)/g, (_, char) => '. ' + char.toUpperCase());

    // Add assistant message to session
    session.messages.push({
      role: 'assistant',
      content: responseContent
    });

    res.json({
      response: responseContent
    });

  } catch (error) {
    console.error('Random chat message error:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

/**
 * POST /api/random-chat/decide
 * Submit decision and get character's decision
 */
router.post('/decide', authenticateToken, async (req, res) => {
  try {
    const { sessionId, userDecision } = req.body;
    const userId = req.user.id;

    if (!sessionId || !userDecision) {
      return res.status(400).json({ error: 'Session ID and decision are required' });
    }

    if (userDecision !== 'yes' && userDecision !== 'no') {
      return res.status(400).json({ error: 'Decision must be "yes" or "no"' });
    }

    // Get session
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (session.decided) {
      return res.status(400).json({ error: 'Decision already made' });
    }

    // Mark session as decided
    session.decided = true;
    session.userDecision = userDecision;

    // Generate character's decision based on conversation
    const characterDecision = await generateCharacterDecision(session, userId);
    session.characterDecision = characterDecision;

    console.log(`🎲 Random chat decision: User=${userDecision}, Character=${characterDecision}`);

    res.json({
      userDecision,
      characterDecision,
      isMatch: userDecision === 'yes' && characterDecision === 'yes'
    });

  } catch (error) {
    console.error('Random chat decide error:', error);
    res.status(500).json({ error: error.message || 'Failed to process decision' });
  }
});

/**
 * Generate character's decision based on conversation quality
 */
async function generateCharacterDecision(session, userId) {
  const { characterData, messages } = session;

  // If no messages were exchanged, character says no
  if (messages.length === 0) {
    return 'no';
  }

  // Build conversation summary for decision
  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'User' : characterData.name}: ${m.content}`)
    .join('\n');

  const decisionPrompt = `You are ${characterData.name}. You just finished a 10-minute random chat with someone. Based on the conversation below, decide if you want to match with them.

CONVERSATION:
${conversationText}

Consider:
- Did they seem genuinely interested in getting to know you?
- Was the conversation engaging and fun?
- Did you feel a connection or chemistry?
- Were they respectful and interesting?
- Would you want to continue talking to them?

Be honest based on your personality. Not every conversation leads to a match - it's okay to say no if there wasn't a spark.

Respond with ONLY "yes" or "no" - nothing else.`;

  try {
    const response = await aiService.createBasicCompletion(decisionPrompt, {
      max_tokens: 10,
      userId: userId,
      llmType: 'decision'
    });

    const decision = response.content.toLowerCase().trim();

    // Parse the decision
    if (decision.includes('yes')) {
      return 'yes';
    } else if (decision.includes('no')) {
      return 'no';
    } else {
      // Default to based on conversation length - if they talked a lot, more likely yes
      return messages.length >= 6 ? 'yes' : 'no';
    }

  } catch (error) {
    console.error('Failed to generate character decision:', error);
    // Fallback: if conversation was substantial, say yes
    return messages.length >= 6 ? 'yes' : 'no';
  }
}

export default router;
