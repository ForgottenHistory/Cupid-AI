import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import conversationService from '../../services/conversationService.js';
import messageService from '../../services/messageService.js';
import messageProcessor from '../../services/messageProcessor.js';
import db from '../../db/database.js';

const router = express.Router();

/**
 * GET /api/chat/conversations
 * Get all conversations for the current user
 */
router.get('/', authenticateToken, (req, res) => {
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
 * Query params: limit (default 200), offset (default 0)
 */
router.get('/:characterId', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 200;
    const offset = parseInt(req.query.offset) || 0;

    const conversation = conversationService.getOrCreateConversation(userId, characterId);
    const result = messageService.getMessagesPaginated(conversation.id, limit, offset);

    // Fetch all image URLs for this conversation (for image rotation display)
    const allImageUrls = messageService.getAllImageUrls(conversation.id);

    res.json({
      conversation,
      messages: result.messages,
      total: result.total,
      hasMore: result.hasMore,
      allImageUrls
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

/**
 * POST /api/chat/conversations/:characterId/messages
 * Send a message - returns immediately, AI response comes via WebSocket
 */
router.post('/:characterId/messages', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    const { message, characterData, imageUrl, imageDescription } = req.body;
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

    let savedUserMessage = null;

    // Save user message with image if present
    if (imageUrl && imageDescription) {
      // User sent an image with description
      savedUserMessage = messageService.saveMessage(
        conversation.id,
        'user',
        imageDescription, // Store description as content
        null, // No reaction
        'image', // messageType
        null, // audioUrl
        imageUrl, // imageUrl
        null // imageTags
      );
    } else if (message && message.trim()) {
      // Regular text message
      savedUserMessage = messageService.saveMessage(conversation.id, 'user', message);
    }

    // Return immediately with saved user message (or null if empty)
    res.json({
      success: true,
      message: savedUserMessage,
      conversation
    });

    // Process AI response asynchronously (works even with empty user message)
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
 * POST /api/chat/conversations/:characterId/mark-read
 * Mark all messages in conversation as read
 */
router.post('/:characterId/mark-read', authenticateToken, (req, res) => {
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
router.delete('/:conversationId', authenticateToken, (req, res) => {
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
 * GET /api/chat/conversations/:conversationId/export
 * Export conversation as JSON file
 */
router.get('/:conversationId/export', authenticateToken, (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Get conversation and verify ownership
    const conversation = conversationService.getConversationById(parseInt(conversationId));

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get all messages
    const messages = messageService.getMessages(parseInt(conversationId));

    // Get character info
    const character = db.prepare(`
      SELECT id, name, card_data FROM characters
      WHERE id = ? AND user_id = ?
    `).get(conversation.character_id, userId);

    // Build export object
    const exportData = {
      exportedAt: new Date().toISOString(),
      conversation: {
        id: conversation.id,
        characterId: conversation.character_id,
        characterName: character?.name || conversation.character_name || 'Unknown',
        createdAt: conversation.created_at,
        lastMessage: conversation.last_message,
        messageCount: messages.length
      },
      character: character ? {
        id: character.id,
        name: character.name,
        cardData: character.card_data ? JSON.parse(character.card_data) : null
      } : null,
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        messageType: msg.message_type || 'text',
        createdAt: msg.created_at,
        reaction: msg.reaction,
        imageUrl: msg.image_url,
        audioUrl: msg.audio_url,
        reasoning: msg.reasoning
      }))
    };

    // Set headers for file download
    const filename = `conversation-${conversation.character_name || 'export'}-${Date.now()}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json(exportData);
  } catch (error) {
    console.error('Export conversation error:', error);
    res.status(500).json({ error: error.message || 'Failed to export conversation' });
  }
});

/**
 * GET /api/chat/conversations/:characterId/pending
 * Check if there's a pending AI response for this character
 */
router.get('/:characterId/pending', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    const isPending = messageProcessor.isPending(userId, characterId);
    const pendingInfo = messageProcessor.getPendingInfo(userId, characterId);

    res.json({
      pending: isPending,
      startedAt: pendingInfo?.startedAt || null
    });
  } catch (error) {
    console.error('Check pending error:', error);
    res.status(500).json({ error: error.message || 'Failed to check pending status' });
  }
});

/**
 * PUT /api/chat/conversations/:characterId/mood
 * Update character mood for the conversation
 */
router.put('/:characterId/mood', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const { mood } = req.body;
    const userId = req.user.id;

    if (!mood || typeof mood !== 'string') {
      return res.status(400).json({ error: 'Mood is required and must be a string' });
    }

    // Get conversation
    const conversation = conversationService.getConversation(userId, characterId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Update mood in database
    db.prepare(`UPDATE conversations SET character_mood = ? WHERE id = ?`).run(mood.trim(), conversation.id);

    console.log(`🎭 Character mood manually updated: ${mood}`);

    // Emit mood update to frontend
    const io = req.app.get('io');
    io.to(`user:${userId}`).emit('character_mood_update', {
      characterId,
      conversationId: conversation.id,
      mood: mood.trim()
    });

    res.json({ success: true, mood: mood.trim() });
  } catch (error) {
    console.error('Update mood error:', error);
    res.status(500).json({ error: error.message || 'Failed to update mood' });
  }
});

/**
 * PUT /api/chat/conversations/:characterId/state
 * Update character state for the conversation
 */
router.put('/:characterId/state', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const { state } = req.body;
    const userId = req.user.id;

    // State can be null (to clear) or a string
    if (state !== null && typeof state !== 'string') {
      return res.status(400).json({ error: 'State must be a string or null' });
    }

    // Get conversation
    const conversation = conversationService.getConversation(userId, characterId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Update state in database (null clears the state)
    const stateValue = state ? state.trim() : null;
    db.prepare(`UPDATE conversations SET character_state = ? WHERE id = ?`).run(stateValue, conversation.id);

    console.log(`⚡ Character state manually updated: ${stateValue || '(cleared)'}`);

    // Emit state update to frontend
    const io = req.app.get('io');
    io.to(`user:${userId}`).emit('character_state_update', {
      characterId,
      conversationId: conversation.id,
      state: stateValue
    });

    res.json({ success: true, state: stateValue });
  } catch (error) {
    console.error('Update state error:', error);
    res.status(500).json({ error: error.message || 'Failed to update state' });
  }
});

/**
 * POST /api/chat/conversations/:characterId/debug-mood
 * Debug endpoint to trigger mood change
 */
router.post('/:characterId/debug-mood', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const { mood, characterName } = req.body;
    const userId = req.user.id;

    const validMoods = ['hearts', 'stars', 'laugh', 'sparkles', 'fire', 'roses'];
    if (!validMoods.includes(mood)) {
      return res.status(400).json({ error: `Invalid mood. Must be one of: ${validMoods.join(', ')}` });
    }

    const charName = characterName || 'Character';

    // Get or create conversation
    const conversation = conversationService.getOrCreateConversation(userId, characterId, charName);
    const systemMessage = `[${charName} switched background to ${mood.toUpperCase()}]`;

    // Save background effect system message to conversation history
    const savedMessage = messageService.saveMessage(
      conversation.id,
      'system',
      systemMessage,
      null, // no reaction
      'text',
      null, // no audio
      null, // no image
      null, // no image tags
      false, // not proactive
      null  // no image prompt
    );

    console.log(`🎨 [DEBUG] Background effect inserted: ${charName} → ${mood}`);

    // Get total message count and update last_mood_message_count
    const totalMsgCount = db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND role IN ('user', 'assistant')
    `).get(conversation.id).count;

    db.prepare(`
      UPDATE character_states
      SET last_mood_message_count = ?
      WHERE user_id = ? AND character_id = ?
    `).run(totalMsgCount, userId, characterId);

    // Emit mood change to frontend
    const io = req.app.get('io');
    io.to(`user:${userId}`).emit('mood_change', {
      characterId,
      mood: mood,
      characterName: charName,
      systemMessage: systemMessage,
      messageId: savedMessage.id
    });

    res.json({ success: true, mood, systemMessage });
  } catch (error) {
    console.error('Debug mood error:', error);
    res.status(500).json({ error: error.message || 'Failed to trigger mood' });
  }
});

export default router;
