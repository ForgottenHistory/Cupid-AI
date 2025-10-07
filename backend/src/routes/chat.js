import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import db from '../db/database.js';
import aiService from '../services/aiService.js';

const router = express.Router();

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
 * Send a message and get AI response
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
    db.prepare(`
      INSERT INTO messages (conversation_id, role, content)
      VALUES (?, ?, ?)
    `).run(conversation.id, 'user', message);

    // Get conversation history for context
    const messageHistory = db.prepare(`
      SELECT role, content FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversation.id);

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
