import db from '../db/database.js';
import aiService from './aiService.js';
import messageService from './messageService.js';
import conversationService from './conversationService.js';
import { getCurrentStatusFromSchedule } from '../utils/chatHelpers.js';

class ProactiveMessageService {
  /**
   * Check if user has reached daily proactive message limit
   */
  checkDailyLimit(userId) {
    const user = db.prepare(`
      SELECT proactive_messages_today, last_proactive_date FROM users WHERE id = ?
    `).get(userId);

    if (!user) return false;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Reset counter if it's a new day
    if (user.last_proactive_date !== today) {
      db.prepare(`
        UPDATE users
        SET proactive_messages_today = 0, last_proactive_date = ?
        WHERE id = ?
      `).run(today, userId);
      return true; // Can send
    }

    // Check if under limit (5 per day)
    return user.proactive_messages_today < 5;
  }

  /**
   * Increment proactive message counter for user
   */
  incrementProactiveCount(userId) {
    const today = new Date().toISOString().split('T')[0];
    db.prepare(`
      UPDATE users
      SET proactive_messages_today = proactive_messages_today + 1,
          last_proactive_date = ?
      WHERE id = ?
    `).run(today, userId);
  }

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

    // Get all users
    const users = db.prepare('SELECT id FROM users').all();

    for (const user of users) {
      // Check daily limit
      if (!this.checkDailyLimit(user.id)) {
        continue;
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

        // Get last message
        const lastMessage = db.prepare(`
          SELECT * FROM messages
          WHERE conversation_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `).get(character.conversation_id);

        // Skip if no messages or last message was from assistant
        if (!lastMessage || lastMessage.role === 'assistant') {
          continue;
        }

        // Calculate time gap (in hours)
        const lastMessageTime = new Date(lastMessage.created_at);
        const now = new Date();
        const gapHours = (now - lastMessageTime) / (1000 * 60 * 60);

        // Skip if gap is less than 1 hour
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
  async processCandidate(candidate, io) {
    try {
      const { userId, characterId, conversationId, gapHours, characterData, personality, schedule } = candidate;

      // Calculate send probability
      const probability = this.calculateSendProbability(gapHours, personality);
      const roll = Math.random() * 100;

      console.log(`🎲 Proactive check: ${characterData.name} (gap: ${gapHours.toFixed(1)}h, prob: ${probability.toFixed(1)}%, roll: ${roll.toFixed(1)}%)`);

      // Random roll
      if (roll > probability) {
        return false; // Don't send
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

      console.log('🎯 Proactive decision:', decision);

      // If decision says don't send, respect it
      if (!decision.shouldSend) {
        return false;
      }

      // Get user bio
      const user = db.prepare('SELECT bio FROM users WHERE id = ?').get(userId);
      const userBio = user?.bio || null;

      // Get current status
      const currentStatusInfo = schedule ? getCurrentStatusFromSchedule(schedule) : { status: 'online' };

      // Generate proactive message
      const aiResponse = await aiService.createChatCompletion({
        messages: messages,
        characterData: characterData,
        userId: userId,
        currentStatus: currentStatusInfo,
        userBio: userBio,
        schedule: schedule,
        isProactive: true,
        proactiveType: decision.messageType
      });

      // Save message
      const savedMessage = messageService.saveMessage(
        conversationId,
        'assistant',
        aiResponse.content,
        null // No reaction for proactive messages
      );

      // Update conversation and increment unread count
      conversationService.incrementUnreadCount(conversationId);

      // Emit to frontend via WebSocket
      io.to(`user:${userId}`).emit('new_message', {
        characterId,
        conversationId,
        message: savedMessage,
        aiResponse: {
          content: aiResponse.content,
          model: aiResponse.model,
          reaction: null
        },
        isProactive: true
      });

      // Increment user's proactive message count
      this.incrementProactiveCount(userId);

      console.log(`✅ Sent proactive message from ${characterData.name} to user ${userId}`);
      return true;
    } catch (error) {
      console.error('Process proactive candidate error:', error);
      return false;
    }
  }

  /**
   * Run the proactive message checker
   * Called every 5 minutes by interval in server.js
   */
  async checkAndSend(io) {
    try {
      console.log('🔍 Checking for proactive message candidates...');

      const candidates = this.findCandidates();
      console.log(`📋 Found ${candidates.length} candidates`);

      // Process each candidate (but stop if we send 5 total)
      let sent = 0;
      for (const candidate of candidates) {
        if (sent >= 5) break; // Global cap to avoid spamming

        const didSend = await this.processCandidate(candidate, io);
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
