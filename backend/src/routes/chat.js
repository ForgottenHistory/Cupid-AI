import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';
import aiService from '../services/aiService.js';
import conversationService from '../services/conversationService.js';
import messageService from '../services/messageService.js';
import messageProcessor from '../services/messageProcessor.js';
import superLikeService from '../services/superLikeService.js';
import { getCurrentStatusFromSchedule } from '../utils/chatHelpers.js';
import db from '../db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for user image uploads
const userImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'user_images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `user_${req.user.id}_${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const uploadUserImage = multer({
  storage: userImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

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

    // Check if this is a super like
    const isSuperLike = superLikeService.isSuperLike(userId, characterId);

    // Generate AI first message with dating app context
    let prompt = `You just matched with someone on a dating app! Send them a fun, flirty, and engaging first message. Make it natural and conversational - like you're genuinely excited about the match. Keep it short (1-2 sentences). Use your personality and interests to make it unique and memorable. Don't be too formal or generic.`;

    if (isSuperLike) {
      prompt = `You just matched with someone on a dating app, and YOU SUPER LIKED THEM! This means you're EXTRA interested and excited about this match. Send them a first message that shows you're genuinely enthusiastic about connecting. Make it fun, flirty, and engaging - maybe reference something from their profile that caught your eye. Keep it short (1-2 sentences) but make your extra interest clear without being overwhelming. Be natural and conversational.`;
    }

    const messages = [
      {
        role: 'user',
        content: prompt
      }
    ];

    const aiResponse = await aiService.createChatCompletion({
      messages,
      characterData: characterData,
      userId: userId,
      currentStatus: currentStatusInfo,
      userBio: userBio,
      schedule: characterData.schedule,
      isSuperLike: isSuperLike,
    });

    // Clean up em dashes (replace with periods)
    const cleanedContent = aiResponse.content.replace(/—/g, '.');

    // Save AI first message
    messageService.saveMessage(conversation.id, 'assistant', cleanedContent);

    // Update conversation timestamp and increment unread count
    conversationService.incrementUnreadCount(conversation.id);

    // Get updated messages
    const allMessages = messageService.getMessages(conversation.id);

    res.json({
      conversation,
      messages: allMessages,
      aiResponse: {
        content: cleanedContent,
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

    // Get character from backend to check voice/image availability
    const backendCharacter = db.prepare('SELECT voice_id, image_tags FROM characters WHERE id = ? AND user_id = ?').get(characterId, userId);
    const hasVoice = backendCharacter?.voice_id ? true : false;
    const hasImage = backendCharacter?.image_tags ? true : false;

    // Call Decision LLM first
    const userMessage = aiMessages[aiMessages.length - 1]?.content || '';
    const decision = await aiService.makeDecision({
      messages: aiMessages,
      characterData: characterData,
      userMessage: userMessage,
      userId: userId,
      isEngaged: true, // Assume engaged for regenerate
      hasVoice: hasVoice,
      hasImage: hasImage
    });

    console.log('🎯 Decision made (regenerate):', decision);

    // Get AI response
    const aiResponse = await aiService.createChatCompletion({
      messages: aiMessages,
      characterData: characterData,
      userId: userId,
      currentStatus: currentStatusInfo,
      userBio: userBio,
      schedule: characterData.schedule,
      decision: decision  // Pass decision to Content LLM
    });

    // Clean up em dashes (replace with periods)
    const cleanedContent = aiResponse.content.replace(/—/g, '.');

    let messageType = 'text';
    let imageUrl = null;

    // Generate image if decision says so (and feature is enabled)
    const imageMessagesEnabled = process.env.IMAGE_MESSAGES_ENABLED === 'true';
    if (imageMessagesEnabled && decision.shouldSendImage && hasImage && backendCharacter?.image_tags && aiResponse.imageTags) {
      console.log(`🎨 Generating image for character ${characterId}`);
      console.log(`Character tags: ${backendCharacter.image_tags}`);
      console.log(`Context tags (from Content LLM): ${aiResponse.imageTags}`);

      try {
        const sdService = (await import('../services/sdService.js')).default;

        // Fetch user's SD settings
        const userSettings = db.prepare(`
          SELECT sd_steps, sd_cfg_scale, sd_sampler, sd_scheduler,
                 sd_enable_hr, sd_hr_scale, sd_hr_upscaler, sd_hr_steps,
                 sd_hr_cfg, sd_denoising_strength, sd_enable_adetailer, sd_adetailer_model,
                 sd_main_prompt, sd_negative_prompt, sd_model
          FROM users WHERE id = ?
        `).get(userId);

        const imageResult = await sdService.generateImage({
          characterTags: backendCharacter.image_tags,
          contextTags: aiResponse.imageTags,
          userSettings: userSettings
        });

        if (imageResult.success) {
          // Save image file
          const fs = await import('fs');
          const path = await import('path');
          const { fileURLToPath } = await import('url');

          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);

          const imageDir = path.join(__dirname, '..', '..', 'uploads', 'images');
          if (!fs.existsSync(imageDir)) {
            fs.mkdirSync(imageDir, { recursive: true });
          }

          const timestamp = Date.now();
          const filename = `image_${characterId}_${timestamp}.png`;
          const filepath = path.join(imageDir, filename);

          fs.writeFileSync(filepath, imageResult.imageBuffer);

          messageType = 'image';
          imageUrl = `/uploads/images/${filename}`;

          console.log(`✅ Image saved: ${imageUrl}`);
        } else {
          console.warn(`⚠️  Image generation failed, falling back to text: ${imageResult.error}`);
        }
      } catch (error) {
        console.error(`❌ Image generation error:`, error);
        console.warn(`⚠️  Falling back to text message`);
      }
    }

    // Save AI response with reaction
    messageService.saveMessage(conversation.id, 'assistant', cleanedContent, decision.reaction, messageType, null, imageUrl, aiResponse.imageTags || null);

    // Update conversation timestamp and increment unread count
    conversationService.incrementUnreadCount(conversation.id);

    // Get updated messages
    const messages = messageService.getMessages(conversation.id);

    res.json({
      conversation,
      messages,
      aiResponse: {
        content: cleanedContent,
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

/**
 * POST /api/chat/upload-user-image
 * Upload a user image for sending in chat
 */
router.post('/upload-user-image', authenticateToken, uploadUserImage.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageUrl = `/uploads/user_images/${req.file.filename}`;
    console.log(`✅ User image uploaded: ${imageUrl}`);

    res.json({ imageUrl });
  } catch (error) {
    console.error('Upload user image error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload image' });
  }
});

export default router;
