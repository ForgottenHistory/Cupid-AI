import express from 'express';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.js';
import aiService from '../services/aiService.js';
import db from '../db/database.js';

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

// Random chat context template - {{TIME_REMAINING}} is replaced before sending
const RANDOM_CHAT_CONTEXT_TEMPLATE = `RANDOM CHAT CONTEXT:
You're in a random/blind chat feature. You don't know this person yet and they don't know you.
- This is a first meeting - you're both strangers
- This is a 10-minute chat. You have {{TIME_REMAINING}} left before you both decide if you want to match.
- Be natural and show your personality, but remember they're a stranger
- Don't be too eager or too distant - feel them out
- This is separate from any existing matches you might have`;

// Blind date context template - user can't see name or image
const BLIND_DATE_CONTEXT_TEMPLATE = `BLIND DATE CONTEXT:
You're in a blind date chat. The other person cannot see your name or picture - only your first initial.
- This is a first meeting - you're both strangers
- This is a 10-minute chat. You have {{TIME_REMAINING}} left before you both decide if you want to match.
- They only know you as "{{FIRST_INITIAL}}" - your identity is hidden
- Don't explicitly state your full name unless directly asked
- Be natural and let your personality shine through your words
- If they match with you, your identity will be revealed
- This is separate from any existing matches you might have`;

/**
 * Build chat context with time remaining
 */
function buildChatContext(session) {
  const elapsed = Date.now() - session.createdAt;
  const remaining = Math.max(0, 10 * 60 * 1000 - elapsed);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  const timeRemaining = minutes > 0
    ? `${minutes} minute${minutes !== 1 ? 's' : ''}`
    : `${seconds} seconds`;

  const characterName = session.characterData?.cardData?.data?.name ||
                        session.characterData?.cardData?.name ||
                        session.characterData?.name || 'Character';
  const firstInitial = characterName.charAt(0).toUpperCase() + '.';

  if (session.mode === 'blind') {
    return BLIND_DATE_CONTEXT_TEMPLATE
      .replace('{{TIME_REMAINING}}', timeRemaining)
      .replace('{{FIRST_INITIAL}}', firstInitial);
  }

  return RANDOM_CHAT_CONTEXT_TEMPLATE.replace('{{TIME_REMAINING}}', timeRemaining);
}

// Keep old function name for compatibility
function buildRandomChatContext(session) {
  return buildChatContext(session);
}

/**
 * POST /api/random-chat/start
 * Start a new random chat session
 */
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { characterId, mode = 'random' } = req.body;
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
      decided: false,
      mode: mode // 'random' or 'blind'
    };

    sessions.set(sessionId, session);

    const modeLabel = mode === 'blind' ? 'Blind date' : 'Random chat';
    console.log(`🎲 ${modeLabel} started: ${sessionId} with ${characterData.name}`);

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
 * POST /api/random-chat/first-message
 * Generate a proactive first message from the character
 */
router.post('/first-message', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Get session
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Don't generate if there are already messages
    if (session.messages.length > 0) {
      return res.status(400).json({ error: 'Conversation already started' });
    }

    // Get user profile info
    const user = db.prepare('SELECT display_name, bio FROM users WHERE id = ?').get(userId);
    const userName = user?.display_name || 'User';
    const userBio = user?.bio || null;

    // Build context for first message
    const randomChatContext = buildRandomChatContext(session);
    const firstMessagePrompt = `${randomChatContext}

FIRST MESSAGE: You're starting this random chat! Send an engaging, friendly opening message.
- Be natural and show your personality
- Keep it short and inviting (1-2 sentences)
- Give them something to respond to
- Don't be too formal or generic`;

    const aiMessages = [
      { role: 'system', content: firstMessagePrompt }
    ];

    // Generate AI response
    const aiResponse = await aiService.createChatCompletion({
      messages: aiMessages,
      characterData: session.characterData.cardData,
      userId: userId,
      userName: userName,
      userBio: userBio,
      maxTokens: 200
    });

    // Clean response
    let responseContent = aiResponse.content || '';
    responseContent = responseContent.replace(/—\s*(.)/g, (_, char) => '. ' + char.toUpperCase());

    // Add assistant message to session
    session.messages.push({
      role: 'assistant',
      content: responseContent
    });

    console.log(`💬 Random chat first message from ${session.characterData.name}: "${responseContent.substring(0, 50)}..."`);

    res.json({
      response: responseContent
    });

  } catch (error) {
    console.error('Random chat first message error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate first message' });
  }
});

/**
 * POST /api/random-chat/message
 * Send a message in random chat
 */
router.post('/message', authenticateToken, async (req, res) => {
  try {
    const { sessionId, message, regenerate } = req.body;
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

    // For regenerate, remove the last assistant message and don't add user message again
    if (regenerate) {
      // Remove the last assistant message if it exists
      if (session.messages.length > 0 && session.messages[session.messages.length - 1].role === 'assistant') {
        session.messages.pop();
      }
    } else {
      // Add user message to session
      session.messages.push({
        role: 'user',
        content: message
      });
    }

    // Get user profile info
    const user = db.prepare('SELECT display_name, bio FROM users WHERE id = ?').get(userId);
    const userName = user?.display_name || 'User';
    const userBio = user?.bio || null;

    // Build messages for AI - prepend random chat context, then conversation messages
    const randomChatContext = buildRandomChatContext(session);
    const aiMessages = [
      { role: 'system', content: randomChatContext },
      ...session.messages
    ];

    // Generate AI response
    const aiResponse = await aiService.createChatCompletion({
      messages: aiMessages,
      characterData: session.characterData.cardData,
      userId: userId,
      userName: userName,
      userBio: userBio,
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
 * POST /api/random-chat/suggest-reply
 * Generate a reply suggestion for the user
 */
router.post('/suggest-reply', authenticateToken, async (req, res) => {
  try {
    const { sessionId, style } = req.body;
    const userId = req.user.id;

    if (!sessionId || !style) {
      return res.status(400).json({ error: 'Session ID and style are required' });
    }

    // Get session
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const characterName = session.characterData.name;

    // Build conversation context
    const recentMessages = session.messages.slice(-10);
    const conversationContext = recentMessages
      .map(m => `${m.role === 'user' ? 'User' : characterName}: ${m.content}`)
      .join('\n');

    const styleDescriptions = {
      serious: 'sincere, thoughtful, and genuine',
      sarcastic: 'witty, playful, and slightly teasing',
      flirty: 'charming, flirtatious, and romantically interested'
    };

    const styleDesc = styleDescriptions[style] || styleDescriptions.serious;

    const prompt = `You are helping a user craft a reply in a dating app conversation. Based on the recent messages, suggest a ${styleDesc} reply the user could send.

Recent conversation:
${conversationContext}

Generate a short, natural reply (1-2 sentences) that the user could send. Only output the reply text, nothing else.`;

    const response = await aiService.createBasicCompletion(prompt, {
      max_tokens: 100,
      userId: userId,
      llmType: 'decision'
    });

    res.json({
      suggestion: response.content.trim()
    });

  } catch (error) {
    console.error('Random chat suggest-reply error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate suggestion' });
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
    const result = await generateCharacterDecision(session, userId);
    session.characterDecision = result.decision;

    console.log(`🎲 Random chat decision: User=${userDecision}, Character=${result.decision}`);

    res.json({
      userDecision,
      characterDecision: result.decision,
      characterReason: result.reason,
      isMatch: userDecision === 'yes' && result.decision === 'yes'
    });

  } catch (error) {
    console.error('Random chat decide error:', error);
    res.status(500).json({ error: error.message || 'Failed to process decision' });
  }
});

/**
 * POST /api/random-chat/convert
 * Convert a random chat session to a real conversation (on match)
 */
router.post('/convert', authenticateToken, async (req, res) => {
  try {
    const { sessionId, forceMatch } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Get session
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Only convert if it was a match (or force match for debugging)
    if (!forceMatch && (session.userDecision !== 'yes' || session.characterDecision !== 'yes')) {
      return res.status(400).json({ error: 'Can only convert matched sessions' });
    }

    const characterId = session.characterId;
    const characterName = session.characterData.name;

    // Create or get conversation
    let conversation = db.prepare(`
      SELECT * FROM conversations WHERE user_id = ? AND character_id = ?
    `).get(userId, characterId);

    if (!conversation) {
      const result = db.prepare(`
        INSERT INTO conversations (user_id, character_id, character_name)
        VALUES (?, ?, ?)
      `).run(userId, characterId, characterName);
      conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(result.lastInsertRowid);
    }

    // Insert all messages from the session
    const insertMsg = db.prepare(`
      INSERT INTO messages (conversation_id, role, content, message_type)
      VALUES (?, ?, ?, 'text')
    `);

    for (const msg of session.messages) {
      insertMsg.run(conversation.id, msg.role, msg.content);
    }

    // Add random chat separator at the end
    db.prepare(`
      INSERT INTO messages (conversation_id, role, content, message_type)
      VALUES (?, 'system', '[RANDOM CHAT MATCH: You matched through random chat!]', 'system')
    `).run(conversation.id);

    // Update conversation timestamp and unread count
    db.prepare(`
      UPDATE conversations
      SET updated_at = CURRENT_TIMESTAMP, unread_count = 0
      WHERE id = ?
    `).run(conversation.id);

    // Clean up the session
    sessions.delete(sessionId);

    console.log(`🎲 Random chat converted to conversation: ${conversation.id}`);

    res.json({
      success: true,
      conversationId: conversation.id
    });

  } catch (error) {
    console.error('Random chat convert error:', error);
    res.status(500).json({ error: error.message || 'Failed to convert session' });
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

  // Get user's display name
  const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
  const userName = user?.display_name || 'User';

  // Build conversation summary for decision
  const conversationText = messages
    .map(m => `${m.role === 'user' ? userName : characterData.name}: ${m.content}`)
    .join('\n');

  const decisionPrompt = `You are ${characterData.name}. You just finished a 10-minute random chat with ${userName}. Based on the conversation below, decide if you want to match with them.

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
      messageType: 'random-chat-decision',
      characterName: characterData.name,
      userName: userName
    });

    const content = response.content.trim();

    // Parse YAML-style response
    const decisionMatch = content.match(/decision:\s*(yes|no)/i);
    const reasonMatch = content.match(/reason:\s*(.+)/i);

    const decision = decisionMatch ? decisionMatch[1].toLowerCase() : null;
    const reason = reasonMatch ? reasonMatch[1].trim() : null;

    if (reason) {
      console.log(`🎲 ${characterData.name}'s reason: ${reason}`);
    }

    // Parse the decision
    if (decision === 'yes') {
      return { decision: 'yes', reason };
    } else if (decision === 'no') {
      return { decision: 'no', reason };
    } else {
      // Fallback: check if content contains yes/no
      if (content.toLowerCase().includes('yes')) return { decision: 'yes', reason };
      if (content.toLowerCase().includes('no')) return { decision: 'no', reason };
      // Default to based on conversation length
      return { decision: messages.length >= 6 ? 'yes' : 'no', reason: null };
    }

  } catch (error) {
    console.error('Failed to generate character decision:', error);
    // Fallback: if conversation was substantial, say yes
    return { decision: messages.length >= 6 ? 'yes' : 'no', reason: null };
  }
}

export default router;
