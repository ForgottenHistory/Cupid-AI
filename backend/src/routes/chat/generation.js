import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authenticateToken } from '../../middleware/auth.js';
import aiService from '../../services/aiService.js';
import decisionEngineService from '../../services/decisionEngineService.js';
import conversationService from '../../services/conversationService.js';
import messageService from '../../services/messageService.js';
import imageTagGenerationService from '../../services/imageTagGenerationService.js';
import sdService from '../../services/sdService.js';
import responseProcessorService from '../../services/responseProcessorService.js';
import { getCurrentStatusFromSchedule } from '../../utils/chatHelpers.js';
import db from '../../db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * POST /api/chat/conversations/:characterId/first-message
 * Generate AI first message for a new match
 */
router.post('/conversations/:characterId/first-message', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    const { characterData, isSuperLike } = req.body;
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
    const prompt = `You just matched with someone on a dating app! Send them a fun, flirty, and engaging first message. Make it natural and conversational - like you're genuinely excited about the match. Keep it short (1-2 sentences). Use your personality and interests to make it unique and memorable. Don't be too formal or generic.`;

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
      isSuperLike: isSuperLike || false,
    });

    // Clean up em dashes (replace with periods and capitalize next letter)
    const cleanedContent = aiResponse.content.replace(/—\s*(.)/g, (_, char) => '. ' + char.toUpperCase());

    // Split content by newlines to create separate messages
    const contentParts = cleanedContent.split('\n').map(part => part.trim()).filter(part => part.length > 0);

    // Validate that we have actual content to send
    if (contentParts.length === 0 || !contentParts[0]) {
      console.warn(`⚠️ AI generated empty first message for conversation ${conversation.id} - this should not happen`);
      return res.status(500).json({ error: 'AI generated empty response' });
    }

    // Save first message with reasoning if available
    messageService.saveMessage(
      conversation.id,
      'assistant',
      contentParts[0],
      null, // no reaction
      'text', // messageType
      null, // audioUrl
      null, // imageUrl
      null, // imageTags
      false, // isProactive
      null, // imagePrompt
      aiResponse.reasoning // reasoning
    );

    // Save subsequent parts without reasoning
    for (let i = 1; i < contentParts.length; i++) {
      messageService.saveMessage(conversation.id, 'assistant', contentParts[i]);
    }

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
 * POST /api/chat/messages/:messageId/regenerate
 * Regenerate a message - creates a new swipe variant
 */
router.post('/messages/:messageId/regenerate', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { characterData } = req.body;
    const userId = req.user.id;

    if (!characterData) {
      return res.status(400).json({ error: 'Character data is required' });
    }

    // Get the message and verify ownership
    const message = messageService.getMessageWithUser(parseInt(messageId));

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Only allow regenerating assistant messages
    if (message.role !== 'assistant') {
      return res.status(400).json({ error: 'Can only regenerate assistant messages' });
    }

    // Get conversation history UP TO this message (not including it)
    const allMessages = messageService.getMessages(message.conversation_id);
    const messageIndex = allMessages.findIndex(m => m.id === parseInt(messageId));
    const historyMessages = allMessages.slice(0, messageIndex);

    // Convert to AI message format
    const aiMessages = historyMessages.map(m => ({
      role: m.role,
      content: m.content
    }));

    // Get character's current status and user bio
    const currentStatusInfo = getCurrentStatusFromSchedule(characterData.schedule);
    const user = db.prepare('SELECT bio FROM users WHERE id = ?').get(userId);
    const userBio = user?.bio || null;

    // Check if this is an image message - regenerate image too
    if (message.message_type === 'image') {
      // Get character's image tags, contextual tags, and prompt overrides
      const backendCharacter = db.prepare(`
        SELECT card_data, image_tags, contextual_tags, main_prompt_override, negative_prompt_override
        FROM characters WHERE id = ? AND user_id = ?
      `).get(characterData.id, userId);

      // Get image tags from backend character or fall back to characterData
      const imageTags = backendCharacter?.image_tags ||
                        characterData.imageTags ||
                        characterData.data?.extensions?.chub?.full_path || '';
      const contextualTags = backendCharacter?.contextual_tags || '';

      // Get SD settings
      const sdSettings = db.prepare(`
        SELECT sd_steps, sd_cfg_scale, sd_sampler, sd_scheduler,
               sd_enable_hr, sd_hr_scale, sd_hr_upscaler, sd_hr_steps,
               sd_hr_cfg, sd_denoising_strength, sd_enable_adetailer, sd_adetailer_model,
               sd_main_prompt, sd_negative_prompt, sd_model,
               sd_width, sd_height, sd_randomize_orientation
        FROM users WHERE id = ?
      `).get(userId);

      // Get recent messages for context from conversation history
      const recentMessages = aiMessages.slice(-50).map(m => ({
        role: m.role,
        content: m.content
      }));

      // Get conversation for mood and state
      const conversation = db.prepare('SELECT character_mood, character_state FROM conversations WHERE id = ?').get(message.conversation_id);

      // Generate context-aware tags using user's Image Tag LLM settings
      const generatedContextTags = await imageTagGenerationService.generateTags({
        recentMessages,
        contextualTags: contextualTags,
        currentStatus: currentStatusInfo,
        userId: userId,
        characterMood: conversation?.character_mood || null,
        characterState: conversation?.character_state || null
      });

      console.log(`📝 Always Needed Tags: ${imageTags}`);
      console.log(`🏷️ Contextual Tags: ${contextualTags}`);
      console.log(`🤖 AI-Generated Context Tags: ${generatedContextTags}`);

      // Generate new image
      const imageResult = await sdService.generateImage({
        characterTags: imageTags,
        contextTags: generatedContextTags,
        userSettings: sdSettings,
        mainPromptOverride: backendCharacter?.main_prompt_override,
        negativePromptOverride: backendCharacter?.negative_prompt_override
      });

      if (!imageResult.success) {
        return res.status(500).json({ error: 'Image generation failed: ' + imageResult.error });
      }

      // Save the new image file
      const imageDir = path.join(__dirname, '..', '..', '..', 'uploads', 'images');
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }

      const timestamp = Date.now();
      const filename = `image_${characterData.id || 'unknown'}_${timestamp}.png`;
      const filepath = path.join(imageDir, filename);
      fs.writeFileSync(filepath, imageResult.imageBuffer);

      const newImageUrl = `/uploads/images/${filename}`;
      const newImagePrompt = imageResult.prompt;

      // Generate a new caption for the image
      const aiResponse = await aiService.createChatCompletion({
        messages: aiMessages,
        characterData: characterData,
        userId: userId,
        currentStatus: currentStatusInfo,
        userBio: userBio,
        schedule: characterData.schedule,
        decision: { shouldSendImage: true, imageTags: `${imageTags}, ${generatedContextTags}` }
      });

      const cleanedContent = aiResponse.content.replace(/—\s*(.)/g, (_, char) => '. ' + char.toUpperCase());

      // Add as image swipe variant
      const result = messageService.addImageSwipe(
        parseInt(messageId),
        cleanedContent,
        newImageUrl,
        newImagePrompt,
        aiResponse.reasoning
      );

      res.json({
        success: true,
        content: cleanedContent,
        imageUrl: newImageUrl,
        imagePrompt: newImagePrompt,
        swipeCount: result.swipeCount,
        currentSwipe: result.currentSwipe,
        message: result.message
      });
    } else {
      // Text message regeneration
      const aiResponse = await aiService.createChatCompletion({
        messages: aiMessages,
        characterData: characterData,
        userId: userId,
        currentStatus: currentStatusInfo,
        userBio: userBio,
        schedule: characterData.schedule
      });

      // Clean up em dashes
      const cleanedContent = aiResponse.content.replace(/—\s*(.)/g, (_, char) => '. ' + char.toUpperCase());

      // Add as new swipe variant
      const result = messageService.addSwipe(parseInt(messageId), cleanedContent, aiResponse.reasoning);

      res.json({
        success: true,
        content: cleanedContent,
        swipeCount: result.swipeCount,
        currentSwipe: result.currentSwipe,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Regenerate message error:', error);
    res.status(500).json({ error: error.message || 'Failed to regenerate message' });
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

    // Check if the last AI message was proactive (so we can preserve that flag)
    const lastAIMessage = db.prepare(`
      SELECT is_proactive FROM messages
      WHERE conversation_id = ? AND role = 'assistant'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(conversation.id);

    const isProactive = lastAIMessage?.is_proactive === 1;
    // For regeneration of proactive messages, default to 'fresh' type
    const proactiveType = isProactive ? 'fresh' : null;

    console.log(`🔄 Regenerating ${isProactive ? 'proactive' : 'normal'} message${isProactive ? ' (type: fresh)' : ''}`);

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
    const backendCharacter = db.prepare('SELECT voice_id, image_tags, contextual_tags FROM characters WHERE id = ? AND user_id = ?').get(characterId, userId);
    const hasVoice = backendCharacter?.voice_id ? true : false;
    const hasImage = backendCharacter?.image_tags ? true : false;

    // Get last mood message count and total message count
    const engagementState = db.prepare(`
      SELECT last_mood_message_count FROM character_states WHERE user_id = ? AND character_id = ?
    `).get(userId, characterId);
    const lastMoodMessageCount = engagementState?.last_mood_message_count || 0;

    const totalMessageCount = db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND role IN ('user', 'assistant')
    `).get(conversation.id).count;

    // Call Decision LLM first
    const userMessage = aiMessages[aiMessages.length - 1]?.content || '';
    const decision = await decisionEngineService.makeDecision({
      messages: aiMessages,
      characterData: characterData,
      characterId: characterId,
      userMessage: userMessage,
      userId: userId,
      isEngaged: true, // Assume engaged for regenerate
      hasVoice: hasVoice,
      hasImage: hasImage,
      lastMoodMessageCount: lastMoodMessageCount,
      assistantMessageCount: totalMessageCount,
      currentStatus: currentStatusInfo,
      schedule: characterData.schedule,
      userBio: userBio,
      currentCharacterState: conversation?.character_state || null,
      currentCharacterMood: conversation?.character_mood || null
    });

    console.log('🎯 Decision made (regenerate):', decision);

    // GENERATE IMAGE FIRST (if decision says so) so Content LLM knows what image was generated
    let imageUrl = null;
    let imagePrompt = null;
    let generatedContextTags = null;
    let messageType = 'text';

    const imageMessagesEnabled = process.env.IMAGE_MESSAGES_ENABLED === 'true';
    if (imageMessagesEnabled && decision.shouldSendImage && hasImage && backendCharacter?.image_tags) {
      console.log(`🎨 Generating image for character ${characterId}`);

      try {
        // Get recent messages for context (last 50)
        const recentMessages = imageTagGenerationService.getRecentMessages(conversation.id, db);

        // Generate context-aware tags using user's Image Tag LLM settings
        // Include mood and state so images reflect character's current situation
        const currentMoodForImage = decision.characterMood || conversation?.character_mood || null;
        const currentStateForImage = decision.characterState || conversation?.character_state || null;

        generatedContextTags = await imageTagGenerationService.generateTags({
          recentMessages,
          contextualTags: backendCharacter.contextual_tags || '',
          currentStatus: currentStatusInfo,
          userId: userId,
          characterMood: currentMoodForImage,
          characterState: currentStateForImage
        });

        console.log(`📍 Current Status: ${currentStatusInfo.status}${currentStatusInfo.activity ? ` (${currentStatusInfo.activity})` : ''}`);
        console.log(`📝 Always Needed Tags: ${backendCharacter.image_tags}`);
        console.log(`🤖 AI-Generated Context Tags: ${generatedContextTags}`);

        // Fetch user's SD settings for image generation
        const sdSettings = db.prepare(`
          SELECT sd_steps, sd_cfg_scale, sd_sampler, sd_scheduler,
                 sd_enable_hr, sd_hr_scale, sd_hr_upscaler, sd_hr_steps,
                 sd_hr_cfg, sd_denoising_strength, sd_enable_adetailer, sd_adetailer_model,
                 sd_main_prompt, sd_negative_prompt, sd_model,
                 sd_width, sd_height, sd_randomize_orientation
          FROM users WHERE id = ?
        `).get(userId);

        // Fetch character-specific prompt overrides
        const character = db.prepare(`
          SELECT main_prompt_override, negative_prompt_override
          FROM characters WHERE id = ? AND user_id = ?
        `).get(characterId, userId);

        const imageResult = await sdService.generateImage({
          characterTags: backendCharacter.image_tags,
          contextTags: generatedContextTags,
          userSettings: sdSettings,
          mainPromptOverride: character?.main_prompt_override,
          negativePromptOverride: character?.negative_prompt_override
        });

        if (imageResult.success) {
          // Save image file
          const imageDir = path.join(__dirname, '..', '..', '..', 'uploads', 'images');
          if (!fs.existsSync(imageDir)) {
            fs.mkdirSync(imageDir, { recursive: true });
          }

          const timestamp = Date.now();
          const filename = `image_${characterId}_${timestamp}.png`;
          const filepath = path.join(imageDir, filename);

          fs.writeFileSync(filepath, imageResult.imageBuffer);

          messageType = 'image';
          imageUrl = `/uploads/images/${filename}`;
          imagePrompt = imageResult.prompt;

          // Add generated tags to decision so Content LLM knows what was generated
          decision.imageTags = `${backendCharacter.image_tags}, ${generatedContextTags}`;

          // Log result to prompt log file
          if (imageResult.logFilename) {
            sdService.appendImageResult({
              logFilename: imageResult.logFilename,
              success: true,
              imagePath: imageUrl,
              generationTime: imageResult.generationTime
            });
          }

          console.log(`✅ Image saved: ${imageUrl}`);
          console.log(`📝 Prompt: ${imagePrompt}`);
        } else {
          console.warn(`⚠️  Image generation failed, falling back to text: ${imageResult.error}`);
          // Clear the decision flag if generation failed
          decision.shouldSendImage = false;
        }
      } catch (error) {
        console.error(`❌ Image generation error:`, error);
        console.warn(`⚠️  Falling back to text message`);
        // Clear the decision flag if generation failed
        decision.shouldSendImage = false;
      }
    }

    // NOW generate AI response - it will know what image was generated
    // Get mood and state from conversation for context
    const currentMood = conversation?.character_mood || null;
    const currentState = conversation?.character_state || null;
    const characterName = characterData.data?.name || characterData.name || 'Character';

    // Use shared response processor with retry logic
    const { cleanedContent, contentParts, aiResponse } = await responseProcessorService.processWithRetry({
      generateFn: () => aiService.createChatCompletion({
        messages: aiMessages,
        characterData: characterData,
        characterId: characterId,
        userId: userId,
        currentStatus: currentStatusInfo,
        userBio: userBio,
        schedule: characterData.schedule,
        decision: decision,
        isProactive: isProactive,
        proactiveType: proactiveType,
        characterMood: currentMood,
        characterState: currentState
      }),
      conversationId: conversation.id,
      aiMessages,
      userId,
      characterName
    });

    // Update last_mood_message_count if mood was set
    if (decision.mood && decision.mood !== 'none') {
      db.prepare(`
        UPDATE character_states
        SET last_mood_message_count = ?
        WHERE user_id = ? AND character_id = ?
      `).run(totalMessageCount, userId, characterId);
      console.log(`✅ Updated last_mood_message_count to ${totalMessageCount} for character ${characterId} (regenerate)`);
    }

    // Save messages using shared service
    const newMessages = responseProcessorService.saveMessageParts({
      conversationId: conversation.id,
      contentParts,
      firstMessageOptions: {
        reaction: decision.reaction,
        messageType,
        imageUrl,
        imageTags: generatedContextTags || null,
        isProactive,
        imagePrompt,
        reasoning: aiResponse.reasoning
      }
    });

    // Update conversation timestamp and increment unread count
    conversationService.incrementUnreadCount(conversation.id);

    res.json({
      conversation,
      newMessages,
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

export default router;
