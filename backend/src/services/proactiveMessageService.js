import db from '../db/database.js';
import aiService from './aiService.js';
import messageService from './messageService.js';
import conversationService from './conversationService.js';
import timeGapService from './timeGapService.js';
import { getCurrentStatusFromSchedule } from '../utils/chatHelpers.js';
import { findCandidates, calculateSendProbability } from './proactiveCandidateFinder.js';
import { generateProactiveImage } from './proactiveImageGenerator.js';
import { updateLeftOnReadRateLimits, updateProactiveRateLimits, handleProactiveUnmatch } from './proactiveRateLimiter.js';

class ProactiveMessageService {

  /**
   * Handle the initial decision logic for a candidate
   * Returns { shouldProceed, decision } or { shouldProceed: false }
   */
  async makeInitialDecision(candidate, messages, debugMode) {
    const { characterData, personality, gapHours, isFirstMessage, triggerType, minutesSinceRead, userId, characterId, schedule } = candidate;
    const characterName = characterData.data?.name || characterData.name || 'Character';
    let decision = null;

    if (triggerType === 'left_on_read') {
      if (debugMode) {
        console.log(`🐛 Debug mode: Bypassing decision engine for left-on-read from ${characterName}`);
        return { shouldProceed: true, decision: { shouldSend: true, messageType: 'left_on_read', reason: 'Debug mode' } };
      }

      console.log(`👀 Left-on-read check: ${characterName} (read ${minutesSinceRead.toFixed(1)} min ago)`);

      decision = await aiService.makeLeftOnReadDecision({
        messages,
        characterData,
        personality,
        minutesSinceRead,
        userId
      });

      console.log(`🎯 Left-on-read decision: ${decision.shouldSend ? 'SEND' : 'DON\'T SEND'} - ${decision.reason}`);

      if (!decision.shouldSend) {
        return { shouldProceed: false };
      }
      return { shouldProceed: true, decision };
    }

    // NORMAL PROACTIVE: Use probability calculation
    const probability = calculateSendProbability(gapHours, personality);
    const roll = Math.random() * 100;

    if (debugMode) {
      console.log(`🐛 Debug mode: Bypassing probability check for ${characterName}`);
    } else {
      const messageType = isFirstMessage ? 'FIRST MESSAGE' : 'continuation';
      console.log(`🎲 Proactive check: ${characterName} (${messageType}, gap: ${gapHours.toFixed(1)}h, prob: ${probability.toFixed(1)}%, roll: ${roll.toFixed(1)}%)`);

      if (roll > probability) {
        return { shouldProceed: false };
      }
    }

    // For first messages, skip Decision Engine
    if (isFirstMessage) {
      console.log(`🎯 First message: AUTO-SEND (icebreaker)`);
      return { shouldProceed: true, decision: null };
    }

    // Call Decision Engine in proactive mode
    const user = db.prepare('SELECT bio FROM users WHERE id = ?').get(userId);
    const userBio = user?.bio || null;
    const currentStatusInfo = getCurrentStatusFromSchedule(schedule);

    decision = await aiService.makeProactiveDecision({
      messages,
      characterData,
      characterId,
      gapHours,
      userId,
      currentStatus: currentStatusInfo,
      schedule,
      userBio
    });

    console.log(`🎯 Proactive decision: ${decision.shouldSend ? 'SEND' : 'DON\'T SEND'} (${decision.messageType}) - ${decision.reason}`);

    if (!decision.shouldSend) {
      return { shouldProceed: false };
    }

    return { shouldProceed: true, decision };
  }

  /**
   * Handle mood and state generation for proactive messages
   */
  async generateMoodAndState(updatedMessages, characterData, characterId, conversationId, userId, gapHours, currentStatusInfo, schedule, userBio, hasImage, characterName, io) {
    // Reset mood and state
    db.prepare(`
      UPDATE conversations SET character_mood = NULL, character_state = NULL WHERE id = ?
    `).run(conversationId);
    console.log(`🔄 Reset character mood and state for proactive message`);

    // Call decision engine to generate fresh mood/state
    const proactiveDecisionResult = await aiService.makeDecision({
      messages: updatedMessages,
      characterData,
      userMessage: `[PROACTIVE MESSAGE CONTEXT: Character is initiating conversation after ${gapHours.toFixed(1)} hour gap]`,
      userId,
      isEngaged: true,
      hasVoice: false,
      hasImage,
      currentStatus: currentStatusInfo,
      schedule,
      userBio,
      shouldGenerateCharacterMood: true,
      currentCharacterState: null,
      currentCharacterMood: null
    });

    let newCharacterMood = null;
    let newCharacterState = null;

    // Handle mood
    if (proactiveDecisionResult.characterMood) {
      newCharacterMood = proactiveDecisionResult.characterMood;
      db.prepare(`UPDATE conversations SET character_mood = ? WHERE id = ?`).run(newCharacterMood, conversationId);
      console.log(`🎭 Proactive message: Character mood set to "${newCharacterMood}"`);

      io.to(`user:${userId}`).emit('character_mood_update', {
        characterId,
        conversationId,
        mood: newCharacterMood,
        characterName
      });
    }

    // Handle state
    if (proactiveDecisionResult.characterState) {
      newCharacterState = proactiveDecisionResult.characterState;
      db.prepare(`UPDATE conversations SET character_state = ? WHERE id = ?`).run(newCharacterState, conversationId);
      console.log(`🎭 Proactive message: Character state set to "${newCharacterState}"`);

      io.to(`user:${userId}`).emit('character_state_update', {
        characterId,
        conversationId,
        state: newCharacterState,
        characterName
      });
    }

    return {
      newCharacterMood,
      newCharacterState,
      shouldSendImage: proactiveDecisionResult.shouldSendImage
    };
  }

  /**
   * Save proactive messages to database
   */
  saveProactiveMessages(conversationId, contentParts, messageType, imageUrl, generatedContextTags, imagePrompt) {
    const firstPart = contentParts[0];
    const savedMessage = messageService.saveMessage(
      conversationId,
      'assistant',
      firstPart,
      null,
      messageType,
      null,
      imageUrl,
      generatedContextTags,
      true,
      imagePrompt
    );

    const allSavedMessages = [savedMessage];
    for (let i = 1; i < contentParts.length; i++) {
      const additionalMessage = messageService.saveMessage(
        conversationId,
        'assistant',
        contentParts[i],
        null,
        'text',
        null,
        null,
        null,
        true
      );
      allSavedMessages.push(additionalMessage);
    }

    return allSavedMessages;
  }

  /**
   * Emit messages to frontend via WebSocket
   */
  emitMessages(allSavedMessages, userId, characterId, conversationId, aiResponse, io) {
    allSavedMessages.forEach(msg => {
      io.to(`user:${userId}`).emit('new_message', {
        characterId,
        conversationId,
        message: msg,
        aiResponse: {
          content: msg.content,
          model: aiResponse.model,
          reaction: null
        },
        isProactive: true
      });
    });
  }

  /**
   * Process a single candidate for proactive messaging
   */
  async processCandidate(candidate, io, debugMode = false) {
    let insertedTimeGapId = null;

    try {
      const { userId, characterId, conversationId, gapHours, characterData, schedule, isFirstMessage, triggerType, userSettings } = candidate;
      const characterName = characterData.data?.name || characterData.name || 'Character';

      // Get conversation data
      const conversation = conversationService.getConversationById(conversationId);
      const matchedDate = conversation?.created_at;
      const messages = messageService.getConversationHistory(conversationId);

      // Make initial decision
      const { shouldProceed, decision } = await this.makeInitialDecision(candidate, messages, debugMode);
      if (!shouldProceed) {
        return false;
      }

      // Insert TIME GAP marker
      const timeGapInserted = timeGapService.checkAndInsertTimeGapForProactive(conversationId);
      if (timeGapInserted) {
        const lastTimeGap = db.prepare(`
          SELECT id FROM messages WHERE conversation_id = ? AND message_type = 'time_gap' ORDER BY created_at DESC LIMIT 1
        `).get(conversationId);
        insertedTimeGapId = lastTimeGap?.id;
      }

      // Refresh conversation history
      const updatedMessages = messageService.getConversationHistory(conversationId);

      // Get user data
      const user = db.prepare('SELECT display_name, bio FROM users WHERE id = ?').get(userId);
      const userName = user?.display_name || 'User';
      const userBio = user?.bio || null;

      // Get current status
      const currentStatusInfo = schedule ? getCurrentStatusFromSchedule(schedule) : { status: 'online' };

      // Check if character can send images
      const imageTags = characterData.image_tags;
      const hasImage = imageTags && imageTags.length > 0;
      const imageMessagesEnabled = process.env.IMAGE_MESSAGES_ENABLED === 'true';

      // Generate mood and state
      const { newCharacterMood, newCharacterState, shouldSendImage: decisionWantsImage } = await this.generateMoodAndState(
        updatedMessages, characterData, characterId, conversationId, userId, gapHours,
        currentStatusInfo, schedule, userBio, hasImage, characterName, io
      );

      // Generate image if needed
      let imageUrl = null;
      let imagePrompt = null;
      let generatedContextTags = null;
      let messageType = 'text';

      const shouldSendImage = imageMessagesEnabled && hasImage && decisionWantsImage;
      if (shouldSendImage) {
        console.log(`📷 Proactive image decision: YES`);
        const imageResult = await generateProactiveImage(characterId, conversationId, imageTags, characterData, userId);
        if (imageResult.success) {
          imageUrl = imageResult.imageUrl;
          imagePrompt = imageResult.imagePrompt;
          generatedContextTags = imageResult.contextTags;
          messageType = imageResult.messageType;
        }
      } else if (imageMessagesEnabled && hasImage) {
        console.log(`📷 Proactive image decision: NO`);
      }

      // Generate proactive message content
      const aiResponse = await aiService.createChatCompletion({
        messages: updatedMessages,
        characterData,
        characterId,
        userId,
        userName,
        currentStatus: currentStatusInfo,
        userBio,
        schedule,
        isProactive: true,
        proactiveType: decision?.messageType || 'icebreaker',
        gapHours,
        isFirstMessage,
        matchedDate,
        characterMood: newCharacterMood,
        characterState: newCharacterState
      });

      // Clean up content
      const cleanedContent = aiResponse.content.replace(/—\s*(.)/g, (_, char) => '. ' + char.toUpperCase());
      const contentParts = cleanedContent.split('\n').map(part => part.trim()).filter(part => part.length > 0);

      // Validate content
      if (contentParts.length === 0 || !contentParts[0]) {
        console.log(`⚠️ ${characterName} generated empty proactive message - skipping send`);
        // Roll back TIME GAP marker
        if (insertedTimeGapId) {
          db.prepare('DELETE FROM messages WHERE id = ?').run(insertedTimeGapId);
          console.log(`🔄 Rolled back TIME GAP marker (id: ${insertedTimeGapId}) due to empty content`);
        }
        return false;
      }

      // Save messages
      const allSavedMessages = this.saveProactiveMessages(conversationId, contentParts, messageType, imageUrl, generatedContextTags, imagePrompt);

      // Update conversation
      conversationService.incrementUnreadCount(conversationId);

      // Update rate limits
      if (triggerType === 'left_on_read') {
        updateLeftOnReadRateLimits(userId, characterId, characterName);
      } else {
        const { shouldUnmatch, maxConsecutive } = updateProactiveRateLimits(userId, characterId, characterName, userSettings);

        if (shouldUnmatch) {
          handleProactiveUnmatch(userId, characterId, characterName, conversationId, maxConsecutive, io);
          return true;
        }
      }

      // Emit messages to frontend
      this.emitMessages(allSavedMessages, userId, characterId, conversationId, aiResponse, io);

      console.log(`✅ Sent ${allSavedMessages.length} proactive message(s) from ${characterData.name} to user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Process proactive candidate error:', error.message);
      console.error('Stack:', error.stack);

      // Roll back TIME GAP marker
      if (insertedTimeGapId) {
        try {
          db.prepare('DELETE FROM messages WHERE id = ?').run(insertedTimeGapId);
          console.log(`🔄 Rolled back TIME GAP marker (id: ${insertedTimeGapId}) due to proactive message error`);
        } catch (rollbackError) {
          console.error('Failed to roll back TIME GAP marker:', rollbackError);
        }
      }

      return false;
    }
  }

  /**
   * Run the proactive message checker
   */
  async checkAndSend(io, debugCharacterId = null) {
    try {
      console.log('🔍 Checking for proactive message candidates...');

      const candidates = findCandidates();
      console.log(`📋 Found ${candidates.length} candidates`);

      // Filter to specific character if debug mode
      let targetCandidates = candidates;
      if (debugCharacterId) {
        targetCandidates = candidates.filter(c => c.characterId === debugCharacterId);
        if (targetCandidates.length === 0) {
          console.log(`⚠️ Debug: Character ${debugCharacterId} not found in candidates`);
          return;
        }
      }

      // Process candidates
      let sent = 0;
      for (const candidate of targetCandidates) {
        const didSend = await this.processCandidate(candidate, io, !!debugCharacterId);
        if (didSend) {
          sent++;
          if (candidate.triggerType === 'normal') {
            console.log(`✅ Sent 1 proactive message - stopping to respect check interval`);
            break;
          }
        }
      }

      if (sent > 0) {
        console.log(`✅ Sent ${sent} message(s) total`);
      }
    } catch (error) {
      console.error('Proactive message checker error:', error);
    }
  }
}

export default new ProactiveMessageService();
