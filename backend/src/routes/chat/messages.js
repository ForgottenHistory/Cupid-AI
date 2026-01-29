import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import messageService from '../../services/messageService.js';
import conversationService from '../../services/conversationService.js';

const router = express.Router();

/**
 * PUT /api/chat/messages/:messageId
 * Edit a message's content
 */
router.put('/:messageId', authenticateToken, (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    messageService.editMessage(messageId, userId, content);

    // Update conversation timestamp and refresh cached last_message
    const message = messageService.getMessageWithUser(messageId);
    conversationService.updateTimestamp(message.conversation_id);
    conversationService.refreshLastMessage(message.conversation_id);

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
 * POST /api/chat/messages/:messageId/swipe
 * Navigate to a different swipe variant
 */
router.post('/:messageId/swipe', authenticateToken, (req, res) => {
  try {
    const { messageId } = req.params;
    const { swipeIndex } = req.body;
    const userId = req.user.id;

    if (typeof swipeIndex !== 'number') {
      return res.status(400).json({ error: 'swipeIndex is required and must be a number' });
    }

    const message = messageService.setSwipeIndex(parseInt(messageId), userId, swipeIndex);
    res.json({ success: true, message });
  } catch (error) {
    console.error('Swipe message error:', error);
    let status = 500;
    if (error.message === 'Message not found') status = 404;
    if (error.message === 'Unauthorized') status = 403;
    if (error.message === 'Swipe index out of range') status = 400;
    res.status(status).json({ error: error.message || 'Failed to swipe message' });
  }
});

/**
 * GET /api/chat/messages/:messageId/swipes
 * Get swipe info for a message
 */
router.get('/:messageId/swipes', authenticateToken, (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const message = messageService.getMessageWithUser(parseInt(messageId));

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const swipeInfo = messageService.getSwipeInfo(parseInt(messageId));
    res.json(swipeInfo);
  } catch (error) {
    console.error('Get swipes error:', error);
    res.status(500).json({ error: error.message || 'Failed to get swipes' });
  }
});

/**
 * DELETE /api/chat/messages/:messageId/delete-from
 * Delete a message and all messages after it in the conversation
 */
router.delete('/:messageId/delete-from', authenticateToken, (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const conversationId = messageService.deleteFromMessage(messageId, userId);

    // Update conversation timestamp and refresh cached last_message
    conversationService.updateTimestamp(conversationId);
    conversationService.refreshLastMessage(conversationId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete from message error:', error);
    let status = 500;
    if (error.message === 'Message not found') status = 404;
    if (error.message === 'Unauthorized') status = 403;
    res.status(status).json({ error: error.message || 'Failed to delete messages' });
  }
});

export default router;
