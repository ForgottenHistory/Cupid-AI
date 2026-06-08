import db from '../db/database.js';
import { getCurrentStatusFromSchedule } from '../utils/chatHelpers.js';

/**
 * Helper to parse character name from card data
 */
function getCharacterName(character) {
  try {
    const cardData = JSON.parse(character.card_data);
    return cardData.data?.name || cardData.name || 'Character';
  } catch (e) {
    return 'Character';
  }
}

/**
 * Check if user should be checked for proactive messages
 * Uses a random interval between min and max for each check
 */
function shouldCheckUser(user) {
  const minInterval = user.proactive_check_interval_min || 5;
  const maxInterval = user.proactive_check_interval_max || 15;
  // Pick a random interval between min and max
  const checkInterval = minInterval + Math.random() * (maxInterval - minInterval);

  if (user.last_proactive_check_at) {
    const lastCheckTime = new Date(user.last_proactive_check_at);
    const now = new Date();
    const minutesSinceCheck = (now - lastCheckTime) / (1000 * 60);
    if (minutesSinceCheck < checkInterval) {
      return false;
    }
  }
  return true;
}

/**
 * Check and reset daily counters if needed
 */
function checkDailyLimits(user, today) {
  const dailyLimit = user.daily_proactive_limit ?? 5;

  // Reset counter if it's a new day
  if (user.last_proactive_date !== today) {
    db.prepare('UPDATE users SET proactive_messages_today = 0, last_proactive_date = ? WHERE id = ?').run(today, user.id);
    user.proactive_messages_today = 0;
    console.log(`📅 Reset daily proactive counter for user ${user.id}`);
  }

  // 0 = unlimited
  if (dailyLimit === 0) return true;

  return user.proactive_messages_today < dailyLimit;
}

/**
 * Check global cooldown status
 */
function checkGlobalCooldown(user) {
  if (user.last_global_proactive_at) {
    const lastGlobalTime = new Date(user.last_global_proactive_at);
    const now = new Date();
    const minutesSinceGlobal = (now - lastGlobalTime) / (1000 * 60);

    if (minutesSinceGlobal < 30) {
      console.log(`⏱️  User ${user.id} on global cooldown (${(30 - minutesSinceGlobal).toFixed(1)} min remaining)`);
      return true;
    }
  }
  return false;
}

/**
 * Reset consecutive proactive count if needed
 */
function checkAndResetConsecutiveCount(character, lastMessage, user) {
  const consecutiveCount = character.consecutive_proactive_count || 0;
  // Reset when there's no outstanding chain of unanswered proactives:
  // - empty conversation (no messages at all)
  // - user replied
  // - a non-proactive assistant message was sent
  const shouldReset = consecutiveCount > 0 && (
    !lastMessage ||
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

    const characterName = getCharacterName(character);
    const resetReason = !lastMessage ? 'empty conversation' : (lastMessage.role === 'user' ? 'user replied' : 'normal response sent');
    console.log(`🔄 ${characterName}: Reset consecutive count (was ${consecutiveCount}) - reason: ${resetReason}`);
  }
}

/**
 * Check per-character cooldown
 */
function isOnCharacterCooldown(character, user) {
  const currentCooldown = character.current_proactive_cooldown || 60;

  if (character.last_proactive_at) {
    const lastCharacterTime = new Date(character.last_proactive_at);
    const now = new Date();
    const minutesSinceCharacter = (now - lastCharacterTime) / (1000 * 60);

    if (minutesSinceCharacter < currentCooldown) {
      const characterName = getCharacterName(character);
      const cooldownDisplay = currentCooldown >= 60 ? `${(currentCooldown / 60).toFixed(1)}h` : `${currentCooldown}min`;
      const maxConsecutive = user.max_consecutive_proactive || 4;
      console.log(`⏱️  ${characterName} on character cooldown (${(currentCooldown - minutesSinceCharacter).toFixed(1)} min remaining, total: ${cooldownDisplay}) [consecutive: ${character.consecutive_proactive_count}/${maxConsecutive}]`);
      return true;
    }
  }
  return false;
}

/**
 * Check if character is at consecutive cap
 */
function isAtConsecutiveCap(character, user) {
  const maxConsecutive = user.max_consecutive_proactive || 4;
  if (character.consecutive_proactive_count >= maxConsecutive) {
    const characterName = getCharacterName(character);
    console.log(`🚫 ${characterName} at consecutive cap (${character.consecutive_proactive_count}/${maxConsecutive}) - should be unmatched`);
    return true;
  }
  return false;
}

/**
 * Calculate time gap for proactive message
 */
function calculateTimeGap(lastUserMessage, conversation) {
  const now = new Date();
  let gapHours;
  let isFirstMessage = false;

  if (lastUserMessage) {
    const lastUserMessageTime = new Date(lastUserMessage.created_at);
    gapHours = (now - lastUserMessageTime) / (1000 * 60 * 60);
  } else {
    const matchTime = new Date(conversation.created_at);
    gapHours = (now - matchTime) / (1000 * 60 * 60);
    isFirstMessage = true;
  }

  return { gapHours, isFirstMessage };
}

/**
 * Check status probability for sending proactive message
 */
function passesStatusProbability(statusInfo, user) {
  const roll = Math.random() * 100;

  if (statusInfo.status === 'online') {
    const onlineChance = user.proactive_online_chance ?? 100;
    return roll <= onlineChance;
  } else if (statusInfo.status === 'away') {
    const awayChance = user.proactive_away_chance || 50;
    return roll <= awayChance;
  } else if (statusInfo.status === 'busy') {
    const busyChance = user.proactive_busy_chance || 10;
    return roll <= busyChance;
  }
  // Offline: Never send
  return false;
}

/**
 * Find candidates for proactive messages
 */
export function findCandidates() {
  const candidates = [];

  const users = db.prepare(`
    SELECT id, last_global_proactive_at, proactive_message_hours, daily_proactive_limit,
           proactive_online_chance, proactive_away_chance, proactive_busy_chance,
           proactive_messages_today, last_proactive_date, proactive_check_interval_min,
           proactive_check_interval_max, last_proactive_check_at, max_consecutive_proactive,
           proactive_cooldown_multiplier, auto_unmatch_after_proactive
    FROM users
  `).all();

  const today = new Date().toISOString().split('T')[0];

  for (const user of users) {
    // Check if enough time has passed since last check
    if (!shouldCheckUser(user)) {
      continue;
    }

    // Update last check time
    db.prepare('UPDATE users SET last_proactive_check_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Check daily limit
    if (!checkDailyLimits(user, today)) {
      const dailyLimit = user.daily_proactive_limit ?? 5;
      console.log(`🚫 User ${user.id} has reached daily proactive limit (${user.proactive_messages_today}/${dailyLimit === 0 ? '∞' : dailyLimit})`);
      continue;
    }

    // Check global cooldown
    const onGlobalCooldown = checkGlobalCooldown(user);

    // Get all matched characters for this user
    const characters = db.prepare(`
      SELECT c.*, conv.id as conversation_id
      FROM characters c
      LEFT JOIN conversations conv ON conv.user_id = ? AND conv.character_id = c.id
      WHERE c.user_id = ?
    `).all(user.id, user.id);

    for (const character of characters) {
      if (!character.conversation_id) continue;

      const conversation = db.prepare(`SELECT created_at FROM conversations WHERE id = ?`).get(character.conversation_id);
      if (!conversation) continue;

      // Last genuine conversational message (ignore system rows: time_gap, summary, unmatch separators)
      const lastMessage = db.prepare(`
        SELECT * FROM messages WHERE conversation_id = ? AND role != 'system' ORDER BY created_at DESC LIMIT 1
      `).get(character.conversation_id);

      const lastUserMessage = db.prepare(`
        SELECT * FROM messages WHERE conversation_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 1
      `).get(character.conversation_id);

      // Reset consecutive count if needed
      checkAndResetConsecutiveCount(character, lastMessage, user);

      // Check cooldowns
      if (isOnCharacterCooldown(character, user)) continue;
      if (isAtConsecutiveCap(character, user)) continue;

      // Check minimum time since last proactive
      const minHours = user.proactive_message_hours || 4;
      if (character.last_proactive_at) {
        const hoursSinceProactive = (new Date() - new Date(character.last_proactive_at)) / (1000 * 60 * 60);
        if (hoursSinceProactive < minHours) continue;
      }

      // Calculate time gap
      const { gapHours, isFirstMessage } = calculateTimeGap(lastUserMessage, conversation);
      if (gapHours < minHours) continue;

      // Parse character data
      let characterData, schedule;
      try {
        characterData = JSON.parse(character.card_data);
        schedule = character.schedule_data ? JSON.parse(character.schedule_data) : null;
      } catch (error) {
        console.error('Failed to parse character data:', error);
        continue;
      }

      if (!schedule) {
        console.log(`⚠️ Character ${characterData.data?.name || 'unknown'} has no schedule - skipping`);
        continue;
      }

      // Check status probability
      const statusInfo = getCurrentStatusFromSchedule(schedule);
      if (!passesStatusProbability(statusInfo, user)) continue;

      // Parse personality data
      let personality = null;
      if (character.personality_data) {
        try {
          personality = JSON.parse(character.personality_data);
        } catch (error) {
          console.error('Failed to parse personality data:', error);
        }
      }

      // Skip normal proactive if on global cooldown
      if (onGlobalCooldown) continue;

      // Add normal proactive candidate
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
          dailyProactiveLimit: user.daily_proactive_limit ?? 5,
          proactiveAwayChance: user.proactive_away_chance || 50,
          proactiveBusyChance: user.proactive_busy_chance || 10,
          maxConsecutiveProactive: user.max_consecutive_proactive || 4,
          proactiveCooldownMultiplier: user.proactive_cooldown_multiplier || 2.0,
          autoUnmatchAfterProactive: user.auto_unmatch_after_proactive ?? true
        }
      });
    }
  }

  return candidates;
}

/**
 * Calculate probability of sending proactive message
 */
export function calculateSendProbability(gapHours) {
  // Base probability: 5% per hour, capped at 50%
  return Math.min(gapHours * 5, 50);
}
