import db from '../db/database.js';
import aiService from './aiService.js';
import engagementService from './engagementService.js';
import conversationService from './conversationService.js';
import messageService from './messageService.js';
import ttsService from './ttsService.js';
import { getCurrentStatusFromSchedule, sleep } from '../utils/chatHelpers.js';

class MessageProcessor {
  /**
   * Process AI response asynchronously with engagement system and delays
   */
  async processMessage(io, userId, characterId, conversationId, characterData) {
    try {
      // Get conversation history
      const aiMessages = messageService.getConversationHistory(conversationId);
      const userMessage = aiMessages[aiMessages.length - 1]?.content || '';

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

        // Reload to get the created character
        backendCharacter = db.prepare(`
          SELECT * FROM characters WHERE id = ? AND user_id = ?
        `).get(characterId, userId);
      }

      // Check if character has a voice assigned
      const hasVoice = backendCharacter?.voice_id ? true : false;
      const voiceId = backendCharacter?.voice_id || null;

      // Step 3: Get or create engagement state
      const engagementState = engagementService.getEngagementState(userId, characterId);

      // If engagement state couldn't be created, fall back to simple delay
      if (!engagementState) {
        console.warn('⚠️  Could not create engagement state, using simple delay');

        if (currentStatus === 'offline') {
          console.log('💤 Character is offline - no response');
          io.to(`user:${userId}`).emit('character_offline', { characterId });
          return;
        }

        // Fast ~1s response
        const simpleDelay = Math.floor(Math.random() * 1500) + 500; // 0.5-2s
        await sleep(simpleDelay);
      } else {
        // Normal engagement flow

        // Check if character is on cooldown (can't respond until status changes)
        if (engagementService.isOnCooldown(engagementState, currentStatus)) {
          console.log(`⏸️  Character ${characterId} is on cooldown (waiting for status change)`);
          io.to(`user:${userId}`).emit('character_offline', { characterId });
          return;
        }

        // If status changed from departed status, clear cooldown
        if (engagementState.departed_status && engagementState.departed_status !== currentStatus) {
          engagementService.clearCooldown(userId, characterId);
        }

        engagementService.updateCurrentStatus(userId, characterId, currentStatus);

        // Calculate response delay (fast ~1s response)
        let delay = engagementService.calculateResponseDelay(currentStatus);

        // If offline, character won't respond
        if (delay === null) {
          console.log('💤 Character is offline - no response');
          io.to(`user:${userId}`).emit('character_offline', { characterId });
          return;
        }

        // If disengaged, start engagement (70% chance to engage immediately)
        if (engagementState.engagement_state === 'disengaged') {
          if (Math.random() < 0.7) {
            engagementService.startEngagement(userId, characterId);
            console.log(`⏱️  Response delay: ${(delay / 1000).toFixed(1)}s (engaged)`);
          } else {
            console.log(`⏱️  Character chose not to engage (30% chance)`);
            return; // Don't respond
          }
        } else {
          console.log(`⏱️  Response delay: ${(delay / 1000).toFixed(1)}s (${engagementState.engagement_state})`);
        }

        // Wait for the delay before starting to generate
        await sleep(delay);
      }

      // Now emit typing indicator right before we start generating
      io.to(`user:${userId}`).emit('character_typing', { characterId, conversationId });

      // Check if engagement duration has expired (only if engaged)
      let isDeparting = false;
      if (engagementState && engagementState.engagement_state === 'engaged') {
        const durationCheck = engagementService.checkEngagementDuration(engagementState, currentStatus);
        if (durationCheck.expired) {
          isDeparting = true;
          console.log(`👋 Engagement duration expired (${(durationCheck.duration / 60000).toFixed(1)} min) - character will depart`);
        }
      }

      // Call Decision LLM (pass current engagement state and voice availability)
      const currentlyEngaged = engagementState?.engagement_state === 'engaged';
      const decision = await aiService.makeDecision({
        messages: aiMessages,
        characterData: characterData,
        userMessage: userMessage,
        userId: userId,
        isEngaged: currentlyEngaged,
        hasVoice: hasVoice
      });

      console.log('🎯 Decision made:', decision);

      // Check if character wants to unmatch
      if (decision.shouldUnmatch) {
        console.log(`💔 Character ${characterId} has decided to unmatch user ${userId}`);

        // Delete character from backend (removes match)
        db.prepare(`
          DELETE FROM characters WHERE id = ? AND user_id = ?
        `).run(characterId, userId);

        // Delete conversation and messages
        conversationService.deleteConversation(userId, conversationId);

        // Emit unmatch event to frontend
        io.to(`user:${userId}`).emit('character_unmatched', {
          characterId,
          characterName: characterData.name || 'Character',
          reason: 'The character has decided to unmatch with you.'
        });

        console.log(`✅ Character ${characterId} successfully unmatched user ${userId}`);
        return; // Don't generate response, end processing
      }

      // Get user bio
      const user = db.prepare('SELECT bio FROM users WHERE id = ?').get(userId);
      const userBio = user?.bio || null;

      // Get AI response (if shouldRespond is true)
      let aiResponse = null;
      if (decision.shouldRespond) {
        aiResponse = await aiService.createChatCompletion({
          messages: aiMessages,
          characterData: characterData,
          userId: userId,
          currentStatus: currentStatusInfo,
          userBio: userBio,
          schedule: schedule,
          isDeparting: isDeparting
        });
      }

      // Save AI response with reaction
      if (aiResponse) {
        // Clean up em dashes (replace with periods)
        const cleanedContent = aiResponse.content.replace(/—/g, '.');

        let messageType = 'text';
        let audioUrl = null;

        // Generate voice message if decision says so (and feature is enabled)
        const voiceMessagesEnabled = process.env.VOICE_MESSAGES_ENABLED === 'true';
        if (voiceMessagesEnabled && decision.shouldSendVoice && hasVoice && voiceId) {
          console.log(`🎙️  Generating voice message for character ${characterId} (voice: ${voiceId})`);

          try {
            const voiceResult = await ttsService.generateVoiceMessage({
              text: cleanedContent,
              voiceId: voiceId,
              exaggeration: 0.2,
              cfgWeight: 0.8
            });

            if (voiceResult.success) {
              // Save audio file
              const fs = await import('fs');
              const path = await import('path');
              const { fileURLToPath } = await import('url');

              const __filename = fileURLToPath(import.meta.url);
              const __dirname = path.dirname(__filename);

              const audioDir = path.join(__dirname, '..', '..', 'uploads', 'audio');
              if (!fs.existsSync(audioDir)) {
                fs.mkdirSync(audioDir, { recursive: true });
              }

              const timestamp = Date.now();
              const filename = `voice_${characterId}_${timestamp}.wav`;
              const filepath = path.join(audioDir, filename);

              fs.writeFileSync(filepath, voiceResult.audioBuffer);

              messageType = 'voice';
              audioUrl = `/uploads/audio/${filename}`;

              console.log(`✅ Voice message saved: ${audioUrl}`);
            } else {
              console.warn(`⚠️  Voice generation failed, falling back to text: ${voiceResult.error}`);
            }
          } catch (error) {
            console.error(`❌ Voice generation error:`, error);
            console.warn(`⚠️  Falling back to text message`);
          }
        }

        const savedMessage = messageService.saveMessage(
          conversationId,
          'assistant',
          cleanedContent,
          decision.reaction,
          messageType,
          audioUrl
        );

        // Handle departure
        if (isDeparting && engagementState) {
          engagementService.markDeparted(userId, characterId, currentStatus);
        }

        // Update conversation timestamp and increment unread count
        conversationService.incrementUnreadCount(conversationId);

        // Emit new message to frontend via WebSocket
        io.to(`user:${userId}`).emit('new_message', {
          characterId,
          conversationId,
          message: savedMessage,
          aiResponse: {
            content: cleanedContent,
            model: aiResponse.model,
            reaction: decision.reaction,
            messageType: messageType,
            audioUrl: audioUrl
          }
        });

        console.log(`✅ Sent AI response to user ${userId} (type: ${messageType})`);
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
}

export default new MessageProcessor();
