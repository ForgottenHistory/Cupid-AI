import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import aiService from '../services/aiService.js';
import conversationService from '../services/conversationService.js';
import messageService from '../services/messageService.js';
import messageProcessor from '../services/messageProcessor.js';
import { getCurrentStatusFromSchedule } from '../utils/chatHelpers.js';
import db from '../db/database.js';

const router = express.Router();

/**
 * GET /api/chat/conversations
 * Get all conversations for the current user
 */
router.get('/conversations', authenticateToken, (req, res) => {
  try {
    const conversations = conversationService.getConversations(req.user.id);
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

    const conversation = conversationService.getOrCreateConversation(userId, characterId);
    const messages = messageService.getMessages(conversation.id);

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
    const conversation = conversationService.getOrCreateConversation(
      userId,
      characterId,
      characterData.name || 'Character'
    );

    // Save user message
    const savedUserMessage = messageService.saveMessage(conversation.id, 'user', message);

    // Return immediately with saved user message
    res.json({
      success: true,
      message: savedUserMessage,
      conversation
    });

    // Process AI response asynchronously
    const io = req.app.get('io');
    messageProcessor.processMessage(io, userId, characterId, conversation.id, characterData).catch(error => {
      console.error('Async AI response error:', error);
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

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
    const conversation = conversationService.getOrCreateConversation(
      userId,
      characterId,
      characterData.name || 'Character'
    );

    // Get character's current status and user bio
    const currentStatusInfo = getCurrentStatusFromSchedule(characterData.schedule);
    const user = db.prepare('SELECT bio FROM users WHERE id = ?').get(userId);
    const userBio = user?.bio || null;

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
      currentStatus: currentStatusInfo,
      userBio: userBio,
      schedule: characterData.schedule,
    });

    // Save AI first message
    messageService.saveMessage(conversation.id, 'assistant', aiResponse.content);

    // Update conversation timestamp and increment unread count
    conversationService.incrementUnreadCount(conversation.id);

    // Get updated messages
    const allMessages = messageService.getMessages(conversation.id);

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

    conversationService.markAsRead(userId, characterId);
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    const status = error.message === 'Conversation not found' ? 404 : 500;
    res.status(status).json({ error: error.message || 'Failed to mark messages as read' });
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

    conversationService.deleteConversation(userId, conversationId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    const status = error.message.includes('not found') || error.message.includes('unauthorized') ? 404 : 500;
    res.status(status).json({ error: error.message || 'Failed to delete conversation' });
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

    messageService.editMessage(messageId, userId, content);

    // Update conversation timestamp
    const message = messageService.getMessageWithUser(messageId);
    conversationService.updateTimestamp(message.conversation_id);

    res.json({ success: true });
  } catch (error) {
    console.error('Edit message error:', error);
    let status = 500;
    if (error.message === 'Message not found') status = 404;
    if (error.message === 'Unauthorized') status = 403;
    res.status(status).json({ error: error.message || 'Failed to edit message' });
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

    const conversationId = messageService.deleteFromMessage(messageId, userId);

    // Update conversation timestamp
    conversationService.updateTimestamp(conversationId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete from message error:', error);
    let status = 500;
    if (error.message === 'Message not found') status = 404;
    if (error.message === 'Unauthorized') status = 403;
    res.status(status).json({ error: error.message || 'Failed to delete messages' });
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
    const conversation = conversationService.getConversation(userId, characterId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get conversation history for context
    const aiMessages = messageService.getConversationHistory(conversation.id);

    if (aiMessages.length === 0) {
      return res.status(400).json({ error: 'No messages to regenerate from' });
    }

    // Get character's current status and user bio
    const currentStatusInfo = getCurrentStatusFromSchedule(characterData.schedule);
    const user = db.prepare('SELECT bio FROM users WHERE id = ?').get(userId);
    const userBio = user?.bio || null;

    // Get AI response
    const aiResponse = await aiService.createChatCompletion({
      messages: aiMessages,
      characterData: characterData,
      userId: userId,
      currentStatus: currentStatusInfo,
      userBio: userBio,
      schedule: characterData.schedule,
    });

    // Save AI response
    messageService.saveMessage(conversation.id, 'assistant', aiResponse.content);

    // Update conversation timestamp and increment unread count
    conversationService.incrementUnreadCount(conversation.id);

    // Get updated messages
    const messages = messageService.getMessages(conversation.id);

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

/**
 * POST /api/chat/conversations/:characterId/suggest-reply
 * Generate a suggested reply for the user based on conversation context
 */
router.post('/conversations/:characterId/suggest-reply', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    const { style, characterData } = req.body; // style: 'serious', 'sarcastic', 'flirty'
    const userId = req.user.id;

    if (!style || !['serious', 'sarcastic', 'flirty'].includes(style)) {
      return res.status(400).json({ error: 'Invalid style. Must be: serious, sarcastic, or flirty' });
    }

    if (!characterData) {
      return res.status(400).json({ error: 'Character data is required' });
    }

    // Get conversation
    const conversation = conversationService.getConversation(userId, characterId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get last 5 messages for context
    const messages = messageService.getMessages(conversation.id);
    const recentMessages = messages.slice(-5);

    if (recentMessages.length === 0) {
      return res.status(400).json({ error: 'No conversation history to base suggestion on' });
    }

    // Build context string
    const contextStr = recentMessages
      .map(m => `${m.role === 'user' ? 'You' : characterData.name}: ${m.content}`)
      .join('\n');

    // Style descriptions
    const styleDescriptions = {
      serious: 'thoughtful, genuine, and sincere',
      sarcastic: 'witty, sarcastic, and playful with a bit of teasing',
      flirty: 'flirty, charming, and playful with romantic undertones'
    };

    const prompt = `You are helping someone write a reply in a dating app conversation. Based on the recent messages below, suggest a short, natural response from the USER's perspective.

Recent conversation:
${contextStr}

Generate a ${styleDescriptions[style]} reply from the user's perspective. Keep it:
- Short (1-2 sentences, like a real text message)
- Natural and conversational
- Appropriate for a dating app
- In the ${style} tone

Output ONLY the suggested reply text, nothing else.`;

    const aiMessages = [{ role: 'user', content: prompt }];

    const response = await aiService.createChatCompletion({
      messages: aiMessages,
      characterData: { name: 'Assistant' },
      userId: userId,
    });

    res.json({ suggestion: response.content.trim() });
  } catch (error) {
    console.error('Suggest reply error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate suggestion' });
  }
});

export default router;
