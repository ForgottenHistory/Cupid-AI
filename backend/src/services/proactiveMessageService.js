import db from '../db/database.js';
import aiService from './aiService.js';
import messageService from './messageService.js';
import conversationService from './conversationService.js';
import { getCurrentStatusFromSchedule } from '../utils/chatHelpers.js';

class ProactiveMessageService {

  /**
   * Calculate probability of sending proactive message
   * Based on time gap, personality (extraversion), and random chance
   */
  calculateSendProbability(gapHours, personality) {
    // Base probability: 5% per hour, capped at 50%
    let baseProbability = Math.min(gapHours * 5, 50);

    // Personality modifier (extraversion)
    // High extraversion (80-100) increases probability
    // Low extraversion (0-20) decreases probability
    const extraversion = personality?.extraversion || 50;
    const personalityModifier = (extraversion - 50) / 2; // Range: -25 to +25

    const finalProbability = Math.max(0, Math.min(100, baseProbability + personalityModifier));

    return finalProbability;
  }

  /**
   * Find candidates for proactive messages
   * Returns array of { userId, characterId, conversationId, gapHours, characterData, personality }
   */
  findCandidates() {
    const candidates = [];

    // Get all users with their last global proactive timestamp
    const users = db.prepare('SELECT id, last_global_proactive_at FROM users').all();

    for (const user of users) {
      // Check global rate limit: 30 minutes between ANY proactive messages
      if (user.last_global_proactive_at) {
        const lastGlobalTime = new Date(user.last_global_proactive_at);
        const now = new Date();
        const minutesSinceGlobal = (now - lastGlobalTime) / (1000 * 60);

        if (minutesSinceGlobal < 30) {
          console.log(`⏱️  User ${user.id} on global cooldown (${(30 - minutesSinceGlobal).toFixed(1)} min remaining)`);
          continue; // Skip this user entirely - too soon since last proactive
        }
      }

      // Get all matched characters for this user
      const characters = db.prepare(`
        SELECT c.*, conv.id as conversation_id
        FROM characters c
        LEFT JOIN conversations conv ON conv.user_id = ? AND conv.character_id = c.id
        WHERE c.user_id = ?
      `).all(user.id, user.id);

      for (const character of characters) {
        if (!character.conversation_id) continue;

        // Check per-character rate limit: 1 hour between proactive messages from same character
        if (character.last_proactive_at) {
          const lastCharacterTime = new Date(character.last_proactive_at);
          const now = new Date();
          const minutesSinceCharacter = (now - lastCharacterTime) / (1000 * 60);

          if (minutesSinceCharacter < 60) {
            // Parse character name for logging
            let characterName = 'Character';
            try {
              const cardData = JSON.parse(character.card_data);
              characterName = cardData.data?.name || cardData.name || 'Character';
            } catch (e) {}

            console.log(`⏱️  ${characterName} on character cooldown (${(60 - minutesSinceCharacter).toFixed(1)} min remaining)`);
            continue; // Skip this character - too soon since last proactive
          }
        }

        // Get last message
        const lastMessage = db.prepare(`
          SELECT * FROM messages
          WHERE conversation_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `).get(character.conversation_id);

        if (!lastMessage) {
          continue;
        }

        // Block if last message was a proactive message from assistant
        // This enforces "no two proactive messages in a row"
        if (lastMessage.role === 'assistant' && lastMessage.is_proactive) {
          continue;
        }

        // Get last message from user
        const lastUserMessage = db.prepare(`
          SELECT * FROM messages
          WHERE conversation_id = ? AND role = 'user'
          ORDER BY created_at DESC
          LIMIT 1
        `).get(character.conversation_id);

        if (!lastUserMessage) {
          continue;
        }

        // Calculate time gap from user's last message (in hours)
        const lastUserMessageTime = new Date(lastUserMessage.created_at);
        const now = new Date();
        const gapHours = (now - lastUserMessageTime) / (1000 * 60 * 60);

        // Skip if user sent a message within the last hour
        if (gapHours < 1) {
          continue;
        }

        // Parse character data and schedule
        let characterData;
        let schedule;
        try {
          characterData = JSON.parse(character.card_data);
          schedule = character.schedule_data ? JSON.parse(character.schedule_data) : null;
        } catch (error) {
          console.error('Failed to parse character data:', error);
          continue;
        }

        // Check if character is currently online
        if (schedule) {
          const statusInfo = getCurrentStatusFromSchedule(schedule);
          if (statusInfo.status !== 'online') {
            continue; // Only send proactive messages when online
          }
        }

        // Parse personality data
        let personality = null;
        if (character.personality_data) {
          try {
            personality = JSON.parse(character.personality_data);
          } catch (error) {
            console.error('Failed to parse personality data:', error);
          }
        }

        // Add to candidates
        candidates.push({
          userId: user.id,
          characterId: character.id,
          conversationId: character.conversation_id,
          gapHours: gapHours,
          characterData: characterData,
          personality: personality,
          schedule: schedule
        });
      }
    }

    return candidates;
  }

  /**
   * Process a single candidate for proactive messaging
   */
  async processCandidate(candidate, io, debugMode = false) {
    try {
      const { userId, characterId, conversationId, gapHours, characterData, personality, schedule } = candidate;

      // Calculate send probability
      const probability = this.calculateSendProbability(gapHours, personality);
      const roll = Math.random() * 100;

      // Extract character name (handle v2 card format)
      const characterName = characterData.data?.name || characterData.name || 'Character';

      if (debugMode) {
        console.log(`🐛 Debug mode: Bypassing probability check for ${characterName}`);
      } else {
        console.log(`🎲 Proactive check: ${characterName} (gap: ${gapHours.toFixed(1)}h, prob: ${probability.toFixed(1)}%, roll: ${roll.toFixed(1)}%)`);

        // Random roll
        if (roll > probability) {
          return false; // Don't send
        }
      }

      // Get conversation history
      const messages = messageService.getConversationHistory(conversationId);

      // Call Decision Engine in proactive mode
      const decision = await aiService.makeProactiveDecision({
        messages: messages,
        characterData: characterData,
        gapHours: gapHours,
        userId: userId
      });

      console.log(`🎯 Proactive decision: ${decision.shouldSend ? 'SEND' : 'DON\'T SEND'} (${decision.messageType}) - ${decision.reason}`);

      // If decision says don't send, respect it
      if (!decision.shouldSend) {
        return false;
      }

      // Get user data
      const user = db.prepare('SELECT display_name, bio FROM users WHERE id = ?').get(userId);
      const userName = user?.display_name || 'User';
      const userBio = user?.bio || null;

      // Get current status
      const currentStatusInfo = schedule ? getCurrentStatusFromSchedule(schedule) : { status: 'online' };

      // Generate proactive message
      const aiResponse = await aiService.createChatCompletion({
        messages: messages,
        characterData: characterData,
        userId: userId,
        userName: userName,
        currentStatus: currentStatusInfo,
        userBio: userBio,
        schedule: schedule,
        isProactive: true,
        proactiveType: decision.messageType,
        gapHours: gapHours
      });

      // Clean up em dashes (replace with periods)
      const cleanedContent = aiResponse.content.replace(/—/g, '.');

      // Save message with is_proactive flag
      const savedMessage = messageService.saveMessage(
        conversationId,
        'assistant',
        cleanedContent,
        null, // No reaction for proactive messages
        'text', // messageType
        null, // audioUrl
        null, // imageUrl
        null, // imageTags
        true // isProactive
      );

      // Update conversation and increment unread count
      conversationService.incrementUnreadCount(conversationId);

      // Update rate limit timestamps
      const now = new Date().toISOString();
      db.prepare('UPDATE users SET last_global_proactive_at = ? WHERE id = ?').run(now, userId);
      db.prepare('UPDATE characters SET last_proactive_at = ? WHERE id = ? AND user_id = ?').run(now, characterId, userId);
      console.log(`⏱️  Rate limits updated: Global cooldown (30 min) and ${characterName} cooldown (60 min) started`);

      // Emit to frontend via WebSocket
      io.to(`user:${userId}`).emit('new_message', {
        characterId,
        conversationId,
        message: savedMessage,
        aiResponse: {
          content: cleanedContent,
          model: aiResponse.model,
          reaction: null
        },
        isProactive: true
      });

      console.log(`✅ Sent proactive message from ${characterData.name} to user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Process proactive candidate error:', error.message);
      console.error('Stack:', error.stack);
      return false;
    }
  }

  /**
   * Run the proactive message checker
   * Called every 5 minutes by interval in server.js
   * @param {Object} io - Socket.io instance
   * @param {String} debugCharacterId - Optional: Character ID for debug mode (bypasses probability)
   */
  async checkAndSend(io, debugCharacterId = null) {
    try {
      console.log('🔍 Checking for proactive message candidates...');

      const candidates = this.findCandidates();
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

      // Process each candidate
      let sent = 0;
      for (const candidate of targetCandidates) {
        const didSend = await this.processCandidate(candidate, io, !!debugCharacterId);
        if (didSend) {
          sent++;
        }
      }

      if (sent > 0) {
        console.log(`✅ Sent ${sent} proactive message(s)`);
      }
    } catch (error) {
      console.error('Proactive message checker error:', error);
    }
  }
}

export default new ProactiveMessageService();
