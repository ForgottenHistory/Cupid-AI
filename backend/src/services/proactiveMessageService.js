import db from '../db/database.js';
import aiService from './aiService.js';
import messageService from './messageService.js';
import conversationService from './conversationService.js';
import timeGapService from './timeGapService.js';
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
   * Find candidates for proactive messages (both normal and left-on-read)
   * Returns array of { userId, characterId, conversationId, gapHours, characterData, personality, userSettings, triggerType, minutesSinceRead }
   */
  findCandidates() {
    const candidates = [];

    // Get all users with their last global proactive timestamp and behavior settings
    const users = db.prepare('SELECT id, last_global_proactive_at, proactive_message_hours, daily_proactive_limit, proactive_away_chance, proactive_busy_chance, proactive_messages_today, last_proactive_date, proactive_check_interval, last_proactive_check_at, left_on_read_messages_today, last_left_on_read_date, daily_left_on_read_limit, left_on_read_trigger_min, left_on_read_trigger_max, left_on_read_character_cooldown, max_consecutive_proactive, proactive_cooldown_multiplier FROM users').all();

    for (const user of users) {
      // Check if enough time has passed since last check for this user
      const checkInterval = user.proactive_check_interval || 5; // Minutes, default 5
      if (user.last_proactive_check_at) {
        const lastCheckTime = new Date(user.last_proactive_check_at);
        const now = new Date();
        const minutesSinceCheck = (now - lastCheckTime) / (1000 * 60);

        if (minutesSinceCheck < checkInterval) {
          continue; // Skip this user - not time to check yet
        }
      }

      // Update last check time for this user
      db.prepare('UPDATE users SET last_proactive_check_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

      // Check daily limit: Has user hit their daily proactive message cap?
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const dailyLimit = user.daily_proactive_limit || 5;

      // Reset counter if it's a new day
      if (user.last_proactive_date !== today) {
        db.prepare('UPDATE users SET proactive_messages_today = 0, last_proactive_date = ? WHERE id = ?').run(today, user.id);
        user.proactive_messages_today = 0;
        console.log(`📅 Reset daily proactive counter for user ${user.id}`);
      }

      // Check if user has hit daily limit
      if (user.proactive_messages_today >= dailyLimit) {
        console.log(`🚫 User ${user.id} has reached daily proactive limit (${user.proactive_messages_today}/${dailyLimit})`);
        continue; // Skip this user - daily limit reached
      }

      // Check global rate limit: 30 minutes between ANY proactive messages
      // NOTE: Left-on-read messages bypass this check (they're reactive, not proactive)
      let onGlobalCooldown = false;
      if (user.last_global_proactive_at) {
        const lastGlobalTime = new Date(user.last_global_proactive_at);
        const now = new Date();
        const minutesSinceGlobal = (now - lastGlobalTime) / (1000 * 60);

        if (minutesSinceGlobal < 30) {
          onGlobalCooldown = true;
          console.log(`⏱️  User ${user.id} on global cooldown (${(30 - minutesSinceGlobal).toFixed(1)} min remaining) - checking left-on-read only`);
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

        // Get conversation details
        const conversation = db.prepare(`
          SELECT created_at FROM conversations WHERE id = ?
        `).get(character.conversation_id);

        if (!conversation) {
          continue;
        }

        // Get last message
        const lastMessage = db.prepare(`
          SELECT * FROM messages
          WHERE conversation_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `).get(character.conversation_id);

        // Get last message from user
        const lastUserMessage = db.prepare(`
          SELECT * FROM messages
          WHERE conversation_id = ? AND role = 'user'
          ORDER BY created_at DESC
          LIMIT 1
        `).get(character.conversation_id);

        // Check consecutive proactive count FIRST (before cooldown check)
        // Reset if: (1) user replied, OR (2) character sent normal (non-proactive) response
        // Only consecutive PROACTIVE messages should count
        const consecutiveCount = character.consecutive_proactive_count || 0;
        const shouldReset = lastMessage && consecutiveCount > 0 && (
          lastMessage.role === 'user' ||
          (lastMessage.role === 'assistant' && !lastMessage.is_proactive)
        );

        if (shouldReset) {
          db.prepare(`
            UPDATE characters
            SET consecutive_proactive_count = 0, current_proactive_cooldown = 60
            WHERE id = ? AND user_id = ?
          `).run(character.id, user.id);
          character.consecutive_proactive_count = 0;
          character.current_proactive_cooldown = 60;

          // Log the reset for debugging
          let characterName = 'Character';
          try {
            const cardData = JSON.parse(character.card_data);
            characterName = cardData.data?.name || cardData.name || 'Character';
          } catch (e) {}

          const resetReason = lastMessage.role === 'user' ? 'user replied' : 'normal response sent';
          console.log(`🔄 ${characterName}: Reset consecutive count (was ${consecutiveCount}) - reason: ${resetReason}`);
        }

        // Check per-character rate limit: Dynamic cooldown based on consecutive proactive count
        // Cooldown = 60 * (multiplier ^ consecutiveCount)
        // Default multiplier 2.0: 1st: 60min, 2nd: 120min, 3rd: 240min, 4th: 480min (unmatch at max)
        const currentCooldown = character.current_proactive_cooldown || 60;

        if (character.last_proactive_at) {
          const lastCharacterTime = new Date(character.last_proactive_at);
          const now = new Date();
          const minutesSinceCharacter = (now - lastCharacterTime) / (1000 * 60);

          if (minutesSinceCharacter < currentCooldown) {
            // Parse character name for logging
            let characterName = 'Character';
            try {
              const cardData = JSON.parse(character.card_data);
              characterName = cardData.data?.name || cardData.name || 'Character';
            } catch (e) {}

            const cooldownDisplay = currentCooldown >= 60 ? `${(currentCooldown / 60).toFixed(1)}h` : `${currentCooldown}min`;
            const maxConsecutive = user.max_consecutive_proactive || 4;
            console.log(`⏱️  ${characterName} on character cooldown (${(currentCooldown - minutesSinceCharacter).toFixed(1)} min remaining, total: ${cooldownDisplay}) [consecutive: ${character.consecutive_proactive_count}/${maxConsecutive}]`);
            continue; // Skip this character - too soon since last proactive
          }
        }

        // Block if consecutive count exceeds max (should have already unmatched, but safety check)
        const maxConsecutive = user.max_consecutive_proactive || 4;
        if (character.consecutive_proactive_count >= maxConsecutive) {
          // Parse character name for logging
          let characterName = 'Character';
          try {
            const cardData = JSON.parse(character.card_data);
            characterName = cardData.data?.name || cardData.name || 'Character';
          } catch (e) {}

          console.log(`🚫 ${characterName} at consecutive cap (${character.consecutive_proactive_count}/${maxConsecutive}) - should be unmatched`);
          continue;
        }

        // Calculate time gap: either from user's last message OR from match time (if no messages)
        let gapHours;
        let isFirstMessage = false;

        if (lastUserMessage) {
          // Normal case: Calculate from user's last message
          const lastUserMessageTime = new Date(lastUserMessage.created_at);
          const now = new Date();
          gapHours = (now - lastUserMessageTime) / (1000 * 60 * 60);
        } else {
          // Empty conversation: Calculate from match time (conversation created_at)
          const matchTime = new Date(conversation.created_at);
          const now = new Date();
          gapHours = (now - matchTime) / (1000 * 60 * 60);
          isFirstMessage = true;
        }

        // Skip if not enough time has passed (default: 4 hours)
        const minHours = user.proactive_message_hours || 4;
        if (gapHours < minHours) {
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

        // Check character status and apply probability for away/busy
        if (!schedule) {
          // No schedule = skip this character (can't determine status)
          console.log(`⚠️ Character ${characterData.data?.name || 'unknown'} has no schedule - skipping`);
          continue;
        }

        const statusInfo = getCurrentStatusFromSchedule(schedule);

        // Online: Always allow (100% chance)
        if (statusInfo.status === 'online') {
          // Continue to next check
        }
        // Away: Check user's away probability setting
        else if (statusInfo.status === 'away') {
          const awayChance = user.proactive_away_chance || 50; // Default 50%
          const roll = Math.random() * 100;
          if (roll > awayChance) {
            continue; // Don't send - failed probability check
          }
        }
        // Busy: Check user's busy probability setting
        else if (statusInfo.status === 'busy') {
          const busyChance = user.proactive_busy_chance || 10; // Default 10%
          const roll = Math.random() * 100;
          if (roll > busyChance) {
            continue; // Don't send - failed probability check
          }
        }
        // Offline: Never send
        else {
          continue;
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

        // CHECK FOR LEFT-ON-READ SCENARIO (separate from normal proactive)
        // Only check if last message was from assistant (not proactive) and user opened chat
        if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.is_proactive) {
          const conversationDetails = db.prepare(`
            SELECT last_opened_at FROM conversations WHERE id = ?
          `).get(character.conversation_id);

          if (conversationDetails?.last_opened_at) {
            const lastOpened = new Date(conversationDetails.last_opened_at);
            const lastMessageTime = new Date(lastMessage.created_at);
            const now = new Date();

            // User opened chat AFTER last message was sent
            if (lastOpened > lastMessageTime) {
              const minutesSinceRead = (now - lastOpened) / (1000 * 60);

              // Trigger window: configurable (default 5-15 minutes)
              const triggerMin = user.left_on_read_trigger_min || 5;
              const triggerMax = user.left_on_read_trigger_max || 15;

              if (minutesSinceRead >= triggerMin && minutesSinceRead <= triggerMax) {
                // Check left-on-read daily limit
                const leftOnReadLimit = user.daily_left_on_read_limit || 10;

                // Reset left-on-read counter if new day
                if (user.last_left_on_read_date !== today) {
                  db.prepare('UPDATE users SET left_on_read_messages_today = 0, last_left_on_read_date = ? WHERE id = ?').run(today, user.id);
                  user.left_on_read_messages_today = 0;
                }

                // Check if under left-on-read daily limit
                if (user.left_on_read_messages_today < leftOnReadLimit) {
                  // Check per-character left-on-read rate limit: configurable (default 120 minutes)
                  const characterCooldown = user.left_on_read_character_cooldown || 120;
                  let canSendLeftOnRead = true;
                  if (character.last_left_on_read_at) {
                    const lastLeftOnReadTime = new Date(character.last_left_on_read_at);
                    const minutesSinceLastLeftOnRead = (now - lastLeftOnReadTime) / (1000 * 60);

                    if (minutesSinceLastLeftOnRead < characterCooldown) {
                      canSendLeftOnRead = false;
                    }
                  }

                  if (canSendLeftOnRead) {
                    // Add as left-on-read candidate (BYPASSES global cooldown)
                    const characterName = characterData.data?.name || characterData.name || 'Character';
                    console.log(`👀 Left-on-read candidate: ${characterName} (read ${minutesSinceRead.toFixed(1)} min ago)`);

                    candidates.push({
                      userId: user.id,
                      characterId: character.id,
                      conversationId: character.conversation_id,
                      gapHours: 0, // Not applicable for left-on-read
                      characterData: characterData,
                      personality: personality,
                      schedule: schedule,
                      isFirstMessage: false,
                      triggerType: 'left_on_read',
                      minutesSinceRead: minutesSinceRead,
                      userSettings: {
                        dailyLeftOnReadLimit: leftOnReadLimit,
                        leftOnReadMessagesToday: user.left_on_read_messages_today
                      }
                    });

                    // Don't add as normal proactive candidate - already added as left-on-read
                    continue;
                  }
                }
              }
            }
          }
        }

        // Skip normal proactive candidates if on global cooldown
        if (onGlobalCooldown) {
          continue;
        }

        // Add to candidates with user settings (normal proactive)
        candidates.push({
          userId: user.id,
          characterId: character.id,
          conversationId: character.conversation_id,
          gapHours: gapHours,
          characterData: characterData,
          personality: personality,
          schedule: schedule,
          isFirstMessage: isFirstMessage,
          triggerType: 'normal',
          userSettings: {
            dailyProactiveLimit: user.daily_proactive_limit || 5,
            proactiveAwayChance: user.proactive_away_chance || 50,
            proactiveBusyChance: user.proactive_busy_chance || 10,
            maxConsecutiveProactive: user.max_consecutive_proactive || 4,
            proactiveCooldownMultiplier: user.proactive_cooldown_multiplier || 2.0
          }
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
      const { userId, characterId, conversationId, gapHours, characterData, personality, schedule, isFirstMessage, triggerType, minutesSinceRead, userSettings } = candidate;

      // Extract character name (handle v2 card format)
      const characterName = characterData.data?.name || characterData.name || 'Character';

      // Get conversation history (TIME GAP insertion happens later, after decision logic)
      const messages = messageService.getConversationHistory(conversationId);

      // Handle different trigger types
      let decision = null;

      if (triggerType === 'left_on_read') {
        // LEFT-ON-READ: Use Decision Engine to decide if character should follow up
        if (debugMode) {
          console.log(`🐛 Debug mode: Bypassing decision engine for left-on-read from ${characterName}`);
          decision = { shouldSend: true, messageType: 'left_on_read', reason: 'Debug mode' };
        } else {
          console.log(`👀 Left-on-read check: ${characterName} (read ${minutesSinceRead.toFixed(1)} min ago)`);

          decision = await aiService.makeLeftOnReadDecision({
            messages: messages,
            characterData: characterData,
            personality: personality,
            minutesSinceRead: minutesSinceRead,
            userId: userId
          });

          console.log(`🎯 Left-on-read decision: ${decision.shouldSend ? 'SEND' : 'DON\'T SEND'} - ${decision.reason}`);

          // If decision says don't send, respect it
          if (!decision.shouldSend) {
            return false;
          }
        }
      } else {
        // NORMAL PROACTIVE: Use probability calculation
        const probability = this.calculateSendProbability(gapHours, personality);
        const roll = Math.random() * 100;

        if (debugMode) {
          console.log(`🐛 Debug mode: Bypassing probability check for ${characterName}`);
        } else {
          const messageType = isFirstMessage ? 'FIRST MESSAGE' : 'continuation';
          console.log(`🎲 Proactive check: ${characterName} (${messageType}, gap: ${gapHours.toFixed(1)}h, prob: ${probability.toFixed(1)}%, roll: ${roll.toFixed(1)}%)`);

          // Random roll
          if (roll > probability) {
            return false; // Don't send
          }
        }

        // For first messages, skip Decision Engine (no context to analyze)
        if (isFirstMessage) {
          console.log(`🎯 First message: AUTO-SEND (icebreaker)`);
        } else {
          // Call Decision Engine in proactive mode
          decision = await aiService.makeProactiveDecision({
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
        }
      }

      // All decisions passed - NOW insert TIME GAP marker (only if message will actually be sent)
      timeGapService.checkAndInsertTimeGap(conversationId);

      // Refresh conversation history to include the TIME GAP marker we just inserted
      const updatedMessages = messageService.getConversationHistory(conversationId);

      // Get user data
      const user = db.prepare('SELECT display_name, bio FROM users WHERE id = ?').get(userId);
      const userName = user?.display_name || 'User';
      const userBio = user?.bio || null;

      // Get current status
      const currentStatusInfo = schedule ? getCurrentStatusFromSchedule(schedule) : { status: 'online' };

      // Generate proactive message
      const aiResponse = await aiService.createChatCompletion({
        messages: updatedMessages,
        characterData: characterData,
        userId: userId,
        userName: userName,
        currentStatus: currentStatusInfo,
        userBio: userBio,
        schedule: schedule,
        isProactive: true,
        proactiveType: decision?.messageType || 'icebreaker',
        gapHours: gapHours,
        isFirstMessage: isFirstMessage
      });

      // Clean up em dashes (replace with periods)
      const cleanedContent = aiResponse.content.replace(/—/g, '. ');

      // Split content by newlines to create separate messages
      const contentParts = cleanedContent.split('\n').map(part => part.trim()).filter(part => part.length > 0);

      // Save first part as proactive message
      const firstPart = contentParts[0] || '';
      const savedMessage = messageService.saveMessage(
        conversationId,
        'assistant',
        firstPart,
        null, // No reaction for proactive messages
        'text', // messageType
        null, // audioUrl
        null, // imageUrl
        null, // imageTags
        true // isProactive
      );

      // Save subsequent parts as separate text messages (also marked as proactive)
      const allSavedMessages = [savedMessage];
      for (let i = 1; i < contentParts.length; i++) {
        const additionalMessage = messageService.saveMessage(
          conversationId,
          'assistant',
          contentParts[i],
          null, // No reaction
          'text', // messageType
          null, // audioUrl
          null, // imageUrl
          null, // imageTags
          true // isProactive
        );
        allSavedMessages.push(additionalMessage);
      }

      // Update conversation and increment unread count
      conversationService.incrementUnreadCount(conversationId);

      // Update rate limit timestamps and increment daily counter
      const now = new Date().toISOString();

      if (triggerType === 'left_on_read') {
        // Left-on-read specific rate limits
        db.prepare('UPDATE users SET left_on_read_messages_today = left_on_read_messages_today + 1 WHERE id = ?').run(userId);
        db.prepare('UPDATE characters SET last_left_on_read_at = ? WHERE id = ? AND user_id = ?').run(now, characterId, userId);

        // Get updated count and cooldown for logging
        const userCount = db.prepare('SELECT left_on_read_messages_today, daily_left_on_read_limit, left_on_read_character_cooldown FROM users WHERE id = ?').get(userId);
        const cooldownMinutes = userCount.left_on_read_character_cooldown || 120;
        const cooldownDisplay = cooldownMinutes >= 60 ? `${(cooldownMinutes / 60).toFixed(1)} hours` : `${cooldownMinutes} min`;
        console.log(`⏱️  Rate limits updated: ${characterName} left-on-read cooldown (${cooldownDisplay}) started`);
        console.log(`📊 Daily left-on-read count: ${userCount.left_on_read_messages_today}/${userCount.daily_left_on_read_limit}`);
      } else {
        // Normal proactive rate limits
        db.prepare('UPDATE users SET last_global_proactive_at = ?, proactive_messages_today = proactive_messages_today + 1 WHERE id = ?').run(now, userId);

        // Get current consecutive count and increment it
        const currentChar = db.prepare('SELECT consecutive_proactive_count, current_proactive_cooldown FROM characters WHERE id = ? AND user_id = ?').get(characterId, userId);
        const newConsecutiveCount = (currentChar.consecutive_proactive_count || 0) + 1;

        // Calculate new cooldown using multiplier (base 60 min, then multiply each time)
        const multiplier = userSettings?.proactiveCooldownMultiplier || 2.0;
        const baseCooldown = 60;
        const newCooldown = baseCooldown * Math.pow(multiplier, newConsecutiveCount);

        // Update character with new consecutive count and cooldown
        db.prepare(`
          UPDATE characters
          SET last_proactive_at = ?,
              consecutive_proactive_count = ?,
              current_proactive_cooldown = ?
          WHERE id = ? AND user_id = ?
        `).run(now, newConsecutiveCount, newCooldown, characterId, userId);

        // Log the update
        const userCount = db.prepare('SELECT proactive_messages_today, daily_proactive_limit FROM users WHERE id = ?').get(userId);
        const cooldownDisplay = newCooldown >= 60 ? `${(newCooldown / 60).toFixed(1)}h` : `${newCooldown}min`;
        const maxConsecutive = userSettings?.maxConsecutiveProactive || 4;
        console.log(`⏱️  Rate limits updated: Global cooldown (30 min) and ${characterName} cooldown (${cooldownDisplay}) started`);
        console.log(`📊 Consecutive proactive count: ${newConsecutiveCount}/${maxConsecutive} (next cooldown: ${cooldownDisplay}, multiplier: ${multiplier}x)`);
        console.log(`📊 Daily proactive count: ${userCount.proactive_messages_today}/${userCount.daily_proactive_limit}`);

        // CHECK FOR UNMATCH: If this exceeds the max consecutive proactive messages
        if (newConsecutiveCount >= maxConsecutive) {
          console.log(`💔 ${characterName} sent ${maxConsecutive} consecutive proactive messages - triggering unmatch for user ${userId}`);

          const unmatchReason = `Character unmatched after ${maxConsecutive} consecutive unanswered messages`;

          // Add UNMATCH separator to conversation history (preserve memory)
          const unmatchSeparator = `[UNMATCH: ${characterName} unmatched - ${unmatchReason}]`;
          messageService.saveMessage(
            conversationId,
            'system',
            unmatchSeparator,
            null, // no reaction
            'text',
            null, // no audio
            null, // no image
            null, // no image tags
            false, // not proactive
            null  // no image prompt
          );
          console.log(`✅ Added UNMATCH separator: ${unmatchSeparator}`);

          // Delete character from backend (removes match, but keeps conversation)
          db.prepare('DELETE FROM characters WHERE id = ? AND user_id = ?').run(characterId, userId);

          // Emit unmatch event to frontend
          io.to(`user:${userId}`).emit('character_unmatched', {
            characterId: characterId,
            characterName: characterName,
            reason: unmatchReason
          });

          console.log(`✅ Unmatch complete for ${characterName} and user ${userId} (conversation preserved)`);
          return true; // Message was sent, but unmatch occurred
        }
      }

      // Emit all messages to frontend via WebSocket
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

      console.log(`✅ Sent ${allSavedMessages.length} proactive message(s) from ${characterData.name} to user ${userId}`);
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

      // Process each candidate (but only send ONE proactive message per check)
      let sent = 0;
      for (const candidate of targetCandidates) {
        const didSend = await this.processCandidate(candidate, io, !!debugCharacterId);
        if (didSend) {
          sent++;
          // Only send one proactive message per check (respects check interval)
          // Left-on-read messages are separate and can send in addition
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
