import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import db from '../db/database.js';
import aiService from '../services/aiService.js';
import engagementService from '../services/engagementService.js';

const router = express.Router();

/**
 * Helper: Get character's current status from schedule
 */
function getCurrentStatusFromSchedule(schedule) {
  if (!schedule?.schedule) {
    return { status: 'online', activity: null };
  }

  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const todaySchedule = schedule.schedule[currentDay];
  if (!todaySchedule || todaySchedule.length === 0) {
    return { status: 'offline', activity: null };
  }

  // Find the block that contains current time
  for (const block of todaySchedule) {
    if (currentTime >= block.start && currentTime < block.end) {
      return {
        status: block.status,
        activity: block.activity || null
      };
    }
  }

  // If no block found, assume offline
  return { status: 'offline', activity: null };
}

/**
 * Helper: Wait for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * GET /api/chat/conversations
 * Get all conversations for the current user
 */
router.get('/conversations', authenticateToken, (req, res) => {
  try {
    const conversations = db.prepare(`
      SELECT
        c.id,
        c.user_id,
        c.character_id,
        c.character_name,
        c.unread_count,
        c.created_at,
        c.updated_at,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
      FROM conversations c
      WHERE c.user_id = ?
      ORDER BY c.updated_at DESC
    `).all(req.user.id);

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

/**
 * GET /api/chat/conversations/:characterId
 * Get or create a conversation with a character
 */
router.get('/conversations/:characterId', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    // Check if conversation exists
    let conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE user_id = ? AND character_id = ?
    `).get(userId, characterId);

    if (!conversation) {
      // Create new conversation
      const result = db.prepare(`
        INSERT INTO conversations (user_id, character_id, character_name)
        VALUES (?, ?, ?)
      `).run(userId, characterId, 'Character'); // We'll update name from frontend

      conversation = db.prepare(`
        SELECT * FROM conversations WHERE id = ?
      `).get(result.lastInsertRowid);
    }

    // Get messages
    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversation.id);

    res.json({ conversation, messages });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

/**
 * POST /api/chat/conversations/:characterId/messages
 * Send a message - returns immediately, AI response comes via WebSocket
 */
router.post('/conversations/:characterId/messages', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    const { message, characterData } = req.body;
    const userId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!characterData) {
      return res.status(400).json({ error: 'Character data is required' });
    }

    // Get or create conversation
    let conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE user_id = ? AND character_id = ?
    `).get(userId, characterId);

    if (!conversation) {
      const result = db.prepare(`
        INSERT INTO conversations (user_id, character_id, character_name)
        VALUES (?, ?, ?)
      `).run(userId, characterId, characterData.name || 'Character');

      conversation = db.prepare(`
        SELECT * FROM conversations WHERE id = ?
      `).get(result.lastInsertRowid);
    }

    // Save user message
    const userMessageResult = db.prepare(`
      INSERT INTO messages (conversation_id, role, content)
      VALUES (?, ?, ?)
    `).run(conversation.id, 'user', message);

    const savedUserMessage = db.prepare(`
      SELECT * FROM messages WHERE id = ?
    `).get(userMessageResult.lastInsertRowid);

    // Return immediately with saved user message
    res.json({
      success: true,
      message: savedUserMessage,
      conversation
    });

    // Process AI response asynchronously
    const io = req.app.get('io');
    processAIResponseAsync(io, userId, characterId, conversation.id, characterData).catch(error => {
      console.error('Async AI response error:', error);
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

/**
 * Async function to process AI response with delays
 */
async function processAIResponseAsync(io, userId, characterId, conversationId, characterData) {
  try {
    // Get conversation history
    const messageHistory = db.prepare(`
      SELECT role, content FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversationId);

    const aiMessages = messageHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const userMessage = messageHistory[messageHistory.length - 1]?.content || '';

    // === ENGAGEMENT WINDOW SYSTEM ===

    // Step 1: Get character's current status from schedule
    const schedule = characterData.schedule;
    const currentStatusInfo = getCurrentStatusFromSchedule(schedule);
    const currentStatus = currentStatusInfo.status;

    console.log(`📍 Character status: ${currentStatus}${currentStatusInfo.activity ? ` (${currentStatusInfo.activity})` : ''}`);

    // Step 2: Ensure character exists in backend (create if needed)
    let backendCharacter = db.prepare(`
      SELECT * FROM characters WHERE id = ? AND user_id = ?
    `).get(characterId, userId);

    if (!backendCharacter) {
      db.prepare(`
        INSERT OR IGNORE INTO characters (id, user_id, name, card_data)
        VALUES (?, ?, ?, ?)
      `).run(characterId, userId, characterData.name || 'Character', JSON.stringify(characterData));
      console.log(`✨ Created character ${characterId} in backend`);
    }

    // Step 3: Get or create engagement state
    const engagementState = engagementService.getEngagementState(userId, characterId);

    // If engagement state couldn't be created, fall back to simple delay
    if (!engagementState) {
      console.warn('⚠️  Could not create engagement state, using simple delay');
      const simpleDelay = currentStatus === 'offline' ? null :
                         currentStatus === 'busy' ? 30000 :
                         currentStatus === 'away' ? 10000 : 5000;

      if (simpleDelay === null) {
        console.log('💤 Character is offline - no response');
        // Emit offline status to frontend
        io.to(`user:${userId}`).emit('character_offline', { characterId });
        return;
      }

      await sleep(simpleDelay);
    } else {
      // Normal engagement flow
      engagementService.updateCurrentStatus(userId, characterId, currentStatus);

      // Calculate response delay
      const responseDelays = schedule?.responseDelays;
      let delay = engagementService.calculateResponseDelay(
        currentStatus,
        engagementState.engagement_state,
        engagementState.engagement_messages_remaining,
        responseDelays
      );

      // If offline, character won't respond
      if (delay === null) {
        console.log('💤 Character is offline - no response');
        io.to(`user:${userId}`).emit('character_offline', { characterId });
        return;
      }

      // If disengaged, start engagement (70% chance to engage immediately)
      if (engagementState.engagement_state === 'disengaged' && Math.random() < 0.7) {
        engagementService.startEngagement(userId, characterId);
        const newState = engagementService.getEngagementState(userId, characterId);
        if (newState) {
          delay = engagementService.calculateResponseDelay(
            currentStatus,
            newState.engagement_state,
            newState.engagement_messages_remaining,
            responseDelays
          );
        }
      }

      console.log(`⏱️  Response delay: ${(delay / 1000).toFixed(1)}s (${engagementState.engagement_state})`);

      // Emit "typing" status to frontend after a brief moment
      await sleep(Math.min(2000, delay * 0.1)); // Wait 2s or 10% of delay, whichever is less
      io.to(`user:${userId}`).emit('character_typing', { characterId, conversationId });

      // Apply remaining delay
      await sleep(delay - Math.min(2000, delay * 0.1));
    }

    // Call Decision LLM
    const decision = await aiService.makeDecision({
      messages: aiMessages,
      characterData: characterData,
      userMessage: userMessage,
      userId: userId
    });

    console.log('🎯 Decision made:', decision);

    // Get AI response (if shouldRespond is true)
    let aiResponse = null;
    if (decision.shouldRespond) {
      aiResponse = await aiService.createChatCompletion({
        messages: aiMessages,
        characterData: characterData,
        userId: userId,
      });
    }

    // Save AI response with reaction
    if (aiResponse) {
      const result = db.prepare(`
        INSERT INTO messages (conversation_id, role, content, reaction)
        VALUES (?, ?, ?, ?)
      `).run(conversationId, 'assistant', aiResponse.content, decision.reaction);

      const savedMessage = db.prepare(`
        SELECT * FROM messages WHERE id = ?
      `).get(result.lastInsertRowid);

      // Consume one engagement message (only if engagement state exists)
      if (engagementState) {
        engagementService.consumeEngagementMessage(userId, characterId);
      }

      // Update conversation timestamp and increment unread count
      db.prepare(`
        UPDATE conversations
        SET updated_at = CURRENT_TIMESTAMP,
            unread_count = unread_count + 1
        WHERE id = ?
      `).run(conversationId);

      // Emit new message to frontend via WebSocket
      io.to(`user:${userId}`).emit('new_message', {
        characterId,
        conversationId,
        message: savedMessage,
        aiResponse: {
          content: aiResponse.content,
          model: aiResponse.model,
          reaction: decision.reaction
        }
      });

      console.log(`✅ Sent AI response to user ${userId}`);
    }
  } catch (error) {
    console.error('Process AI response async error:', error);
    // Emit error to frontend
    io.to(`user:${userId}`).emit('ai_response_error', {
      characterId,
      error: error.message || 'Failed to generate response'
    });
  }
}

/**
 * POST /api/chat/conversations/:characterId/first-message
 * Generate AI first message for a new match
 */
router.post('/conversations/:characterId/first-message', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    const { characterData } = req.body;
    const userId = req.user.id;

    if (!characterData) {
      return res.status(400).json({ error: 'Character data is required' });
    }

    // Get or create conversation
    let conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE user_id = ? AND character_id = ?
    `).get(userId, characterId);

    if (!conversation) {
      const result = db.prepare(`
        INSERT INTO conversations (user_id, character_id, character_name)
        VALUES (?, ?, ?)
      `).run(userId, characterId, characterData.name || 'Character');

      conversation = db.prepare(`
        SELECT * FROM conversations WHERE id = ?
      `).get(result.lastInsertRowid);
    }

    // Generate AI first message with dating app context
    const messages = [
      {
        role: 'user',
        content: `You just matched with someone on a dating app! Send them a fun, flirty, and engaging first message. Make it natural and conversational - like you're genuinely excited about the match. Keep it short (1-2 sentences). Use your personality and interests to make it unique and memorable. Don't be too formal or generic.`
      }
    ];

    const aiResponse = await aiService.createChatCompletion({
      messages,
      characterData: characterData,
      userId: userId,
    });

    // Save AI first message
    db.prepare(`
      INSERT INTO messages (conversation_id, role, content)
      VALUES (?, ?, ?)
    `).run(conversation.id, 'assistant', aiResponse.content);

    // Update conversation timestamp and increment unread count
    db.prepare(`
      UPDATE conversations
      SET updated_at = CURRENT_TIMESTAMP,
          unread_count = unread_count + 1
      WHERE id = ?
    `).run(conversation.id);

    // Get updated messages
    const allMessages = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversation.id);

    res.json({
      conversation,
      messages: allMessages,
      aiResponse: {
        content: aiResponse.content,
        model: aiResponse.model,
      }
    });
  } catch (error) {
    console.error('Generate first message error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate first message' });
  }
});

/**
 * POST /api/chat/conversations/:characterId/mark-read
 * Mark all messages in conversation as read
 */
router.post('/conversations/:characterId/mark-read', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    // Get conversation
    const conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE user_id = ? AND character_id = ?
    `).get(userId, characterId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Reset unread count
    db.prepare(`
      UPDATE conversations
      SET unread_count = 0
      WHERE id = ?
    `).run(conversation.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

/**
 * DELETE /api/chat/conversations/:conversationId
 * Delete a conversation and all its messages
 */
router.delete('/conversations/:conversationId', authenticateToken, (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const conversation = db.prepare(`
      SELECT * FROM conversations WHERE id = ? AND user_id = ?
    `).get(conversationId, userId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Delete messages first (foreign key constraint)
    db.prepare(`DELETE FROM messages WHERE conversation_id = ?`).run(conversationId);

    // Delete conversation
    db.prepare(`DELETE FROM conversations WHERE id = ?`).run(conversationId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

/**
 * PUT /api/chat/messages/:messageId
 * Edit a message's content
 */
router.put('/messages/:messageId', authenticateToken, (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Verify ownership (user owns the conversation this message belongs to)
    const message = db.prepare(`
      SELECT m.*, c.user_id
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.id = ?
    `).get(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update message
    db.prepare(`
      UPDATE messages
      SET content = ?
      WHERE id = ?
    `).run(content, messageId);

    // Update conversation timestamp
    db.prepare(`
      UPDATE conversations
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(message.conversation_id);

    res.json({ success: true });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

/**
 * DELETE /api/chat/messages/:messageId/delete-from
 * Delete a message and all messages after it in the conversation
 */
router.delete('/messages/:messageId/delete-from', authenticateToken, (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Get the message and verify ownership
    const message = db.prepare(`
      SELECT m.*, c.user_id
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.id = ?
    `).get(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete this message and all messages created after it in the same conversation
    db.prepare(`
      DELETE FROM messages
      WHERE conversation_id = ?
        AND created_at >= (
          SELECT created_at FROM messages WHERE id = ?
        )
    `).run(message.conversation_id, messageId);

    // Update conversation timestamp
    db.prepare(`
      UPDATE conversations
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(message.conversation_id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete from message error:', error);
    res.status(500).json({ error: 'Failed to delete messages' });
  }
});

/**
 * POST /api/chat/conversations/:characterId/regenerate
 * Generate a new AI response for the current conversation state
 */
router.post('/conversations/:characterId/regenerate', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    const { characterData } = req.body;
    const userId = req.user.id;

    if (!characterData) {
      return res.status(400).json({ error: 'Character data is required' });
    }

    // Get conversation
    const conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE user_id = ? AND character_id = ?
    `).get(userId, characterId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get conversation history for context
    const messageHistory = db.prepare(`
      SELECT role, content FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversation.id);

    if (messageHistory.length === 0) {
      return res.status(400).json({ error: 'No messages to regenerate from' });
    }

    // Build messages array for AI
    const aiMessages = messageHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Get AI response
    const aiResponse = await aiService.createChatCompletion({
      messages: aiMessages,
      characterData: characterData,
      userId: userId,
    });

    // Save AI response
    db.prepare(`
      INSERT INTO messages (conversation_id, role, content)
      VALUES (?, ?, ?)
    `).run(conversation.id, 'assistant', aiResponse.content);

    // Update conversation timestamp and increment unread count
    db.prepare(`
      UPDATE conversations
      SET updated_at = CURRENT_TIMESTAMP,
          unread_count = unread_count + 1
      WHERE id = ?
    `).run(conversation.id);

    // Get updated messages
    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversation.id);

    res.json({
      conversation,
      messages,
      aiResponse: {
        content: aiResponse.content,
        model: aiResponse.model,
      }
    });
  } catch (error) {
    console.error('Regenerate response error:', error);
    res.status(500).json({ error: error.message || 'Failed to regenerate response' });
  }
});

export default router;
