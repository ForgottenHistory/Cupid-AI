import db from '../db/database.js';
import aiService from './aiService.js';
import engagementService from './engagementService.js';
import conversationService from './conversationService.js';
import messageService from './messageService.js';
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
          io.to(`user:${userId}`).emit('character_offline', { characterId });
          return;
        }

        // Wait for delay without emitting typing
        await sleep(simpleDelay);
      } else {
        // Normal engagement flow
        engagementService.updateCurrentStatus(userId, characterId, currentStatus);

        // Calculate response delay
        const responseDelays = schedule?.responseDelays;
        let delay = engagementService.calculateResponseDelay(
          currentStatus,
          engagementState.engagement_state,
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
              responseDelays
            );
          }
        }

        console.log(`⏱️  Response delay: ${(delay / 1000).toFixed(1)}s (${engagementState.engagement_state})`);

        // Wait for the full delay before starting to generate
        await sleep(delay);
      }

      // Now emit typing indicator right before we start generating
      io.to(`user:${userId}`).emit('character_typing', { characterId, conversationId });

      // Call Decision LLM (pass current engagement state)
      const currentlyEngaged = engagementState?.engagement_state === 'engaged';
      const decision = await aiService.makeDecision({
        messages: aiMessages,
        characterData: characterData,
        userMessage: userMessage,
        userId: userId,
        isEngaged: currentlyEngaged
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
        });
      }

      // Save AI response with reaction
      if (aiResponse) {
        const savedMessage = messageService.saveMessage(
          conversationId,
          'assistant',
          aiResponse.content,
          decision.reaction
        );

        // Handle engagement based on decision
        if (engagementState) {
          if (currentlyEngaged && !decision.continueEngagement) {
            // Character wants to disengage
            engagementService.endEngagement(userId, characterId);
          } else if (!currentlyEngaged && decision.continueEngagement) {
            // Should not happen (decision should return false when disengaged), but handle it
            console.warn('⚠️  Decision engine tried to continue engagement while disengaged');
          }
          // If continueEngagement is true and already engaged, stay engaged (no action needed)
        }

        // Update conversation timestamp and increment unread count
        conversationService.incrementUnreadCount(conversationId);

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
}

export default new MessageProcessor();
