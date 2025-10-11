import db from '../db/database.js';
import aiService from './aiService.js';
import engagementService from './engagementService.js';
import conversationService from './conversationService.js';
import messageService from './messageService.js';
import ttsService from './ttsService.js';
import sdService from './sdService.js';
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

      // Check if character has image tags configured
      const hasImage = backendCharacter?.image_tags ? true : false;
      const imageTags = backendCharacter?.image_tags || null;

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

      // Call Decision LLM (pass current engagement state, voice, image availability, and last mood change)
      const currentlyEngaged = engagementState?.engagement_state === 'engaged';
      const lastMoodChange = engagementState?.last_mood_change || null;
      const decision = await aiService.makeDecision({
        messages: aiMessages,
        characterData: characterData,
        userMessage: userMessage,
        userId: userId,
        isEngaged: currentlyEngaged,
        hasVoice: hasVoice,
        hasImage: hasImage,
        lastMoodChange: lastMoodChange
      });

      console.log('🎯 Decision made:', decision);

      // Insert background effect system message if mood is set (not 'none')
      if (decision.mood && decision.mood !== 'none') {
        const characterName = characterData.name || 'Character';
        const systemMessage = `[${characterName} switched background to ${decision.mood.toUpperCase()}]`;

        // Save background effect system message to conversation history
        const savedMoodMessage = messageService.saveMessage(
          conversationId,
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

        // Add to aiMessages array so Content LLM sees it immediately
        aiMessages.push({
          role: 'system',
          content: systemMessage
        });

        console.log(`🎨 Background effect inserted: ${characterName} → ${decision.mood}`);

        // Update last_mood_change timestamp in character_states
        if (engagementState) {
          db.prepare(`
            UPDATE character_states
            SET last_mood_change = CURRENT_TIMESTAMP
            WHERE user_id = ? AND character_id = ?
          `).run(userId, characterId);
          console.log(`✅ Updated last_mood_change timestamp for character ${characterId}`);
        }

        // Emit mood change to frontend
        io.to(`user:${userId}`).emit('mood_change', {
          characterId,
          mood: decision.mood,
          characterName: characterData.name || 'Character',
          systemMessage: systemMessage,
          messageId: savedMoodMessage.id
        });
      }

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
          isDeparting: isDeparting,
          decision: decision  // Pass decision so Content LLM knows about media
        });
      }

      // Save AI response with reaction
      if (aiResponse) {
        // Clean up em dashes (replace with periods)
        const cleanedContent = aiResponse.content.replace(/—/g, '.');

        let messageType = 'text';
        let audioUrl = null;
        let imageUrl = null;
        let imagePrompt = null;

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

        // Generate image if decision says so (and feature is enabled)
        const imageMessagesEnabled = process.env.IMAGE_MESSAGES_ENABLED === 'true';
        if (imageMessagesEnabled && decision.shouldSendImage && hasImage && imageTags && aiResponse.imageTags) {
          console.log(`🎨 Generating image for character ${characterId}`);
          console.log(`Character tags: ${imageTags}`);
          console.log(`Context tags (from Content LLM): ${aiResponse.imageTags}`);

          try {
            // Fetch user's SD settings
            const userSettings = db.prepare(`
              SELECT sd_steps, sd_cfg_scale, sd_sampler, sd_scheduler,
                     sd_enable_hr, sd_hr_scale, sd_hr_upscaler, sd_hr_steps,
                     sd_hr_cfg, sd_denoising_strength, sd_enable_adetailer, sd_adetailer_model,
                     sd_main_prompt, sd_negative_prompt, sd_model
              FROM users WHERE id = ?
            `).get(userId);

            const imageResult = await sdService.generateImage({
              characterTags: imageTags,
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
              imagePrompt = imageResult.prompt; // Store the full prompt

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
            }
          } catch (error) {
            console.error(`❌ Image generation error:`, error);
            console.warn(`⚠️  Falling back to text message`);
          }
        }

        const savedMessage = messageService.saveMessage(
          conversationId,
          'assistant',
          cleanedContent,
          decision.reaction,
          messageType,
          audioUrl,
          imageUrl,
          aiResponse.imageTags || null,
          false, // isProactive
          imagePrompt // imagePrompt
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
            audioUrl: audioUrl,
            imageUrl: imageUrl
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
