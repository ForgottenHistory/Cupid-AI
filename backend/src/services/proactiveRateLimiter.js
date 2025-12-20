import db from '../db/database.js';
import messageService from './messageService.js';

/**
 * Update rate limits after sending a left-on-read message
 */
export function updateLeftOnReadRateLimits(userId, characterId, characterName) {
  const now = new Date().toISOString();

  db.prepare('UPDATE users SET left_on_read_messages_today = left_on_read_messages_today + 1 WHERE id = ?').run(userId);
  db.prepare('UPDATE characters SET last_left_on_read_at = ? WHERE id = ? AND user_id = ?').run(now, characterId, userId);

  // Get updated count and cooldown for logging
  const userCount = db.prepare('SELECT left_on_read_messages_today, daily_left_on_read_limit, left_on_read_character_cooldown FROM users WHERE id = ?').get(userId);
  const cooldownMinutes = userCount.left_on_read_character_cooldown || 120;
  const cooldownDisplay = cooldownMinutes >= 60 ? `${(cooldownMinutes / 60).toFixed(1)} hours` : `${cooldownMinutes} min`;
  console.log(`⏱️  Rate limits updated: ${characterName} left-on-read cooldown (${cooldownDisplay}) started`);
  console.log(`📊 Daily left-on-read count: ${userCount.left_on_read_messages_today}/${userCount.daily_left_on_read_limit}`);
}

/**
 * Update rate limits after sending a normal proactive message
 * Returns { shouldUnmatch, newConsecutiveCount }
 */
export function updateProactiveRateLimits(userId, characterId, characterName, userSettings) {
  const now = new Date().toISOString();

  db.prepare('UPDATE users SET last_global_proactive_at = ?, proactive_messages_today = proactive_messages_today + 1 WHERE id = ?').run(now, userId);

  // Get current consecutive count and increment it
  const currentChar = db.prepare('SELECT consecutive_proactive_count, current_proactive_cooldown FROM characters WHERE id = ? AND user_id = ?').get(characterId, userId);
  const newConsecutiveCount = (currentChar?.consecutive_proactive_count || 0) + 1;

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

  // SAFEGUARD: Double-check unmatch setting directly from database
  const dbSettings = db.prepare('SELECT auto_unmatch_after_proactive FROM users WHERE id = ?').get(userId);
  const dbAutoUnmatch = dbSettings?.auto_unmatch_after_proactive;
  const passedAutoUnmatch = userSettings?.autoUnmatchAfterProactive;

  // Convert to explicit boolean (SQLite stores as 0/1)
  // Only enable unmatch if BOTH the DB value AND passed value are truthy (or default true if undefined)
  const autoUnmatchFromDb = dbAutoUnmatch === 1 || dbAutoUnmatch === true;
  const autoUnmatchFromSettings = passedAutoUnmatch === 1 || passedAutoUnmatch === true;

  // If DB explicitly has 0 (disabled), NEVER unmatch regardless of what was passed
  const autoUnmatchDisabledInDb = dbAutoUnmatch === 0 || dbAutoUnmatch === false;
  const autoUnmatchAfterProactive = autoUnmatchDisabledInDb ? false : (autoUnmatchFromDb || autoUnmatchFromSettings || (dbAutoUnmatch === undefined && passedAutoUnmatch === undefined));

  console.log(`🔒 Unmatch setting check: DB=${dbAutoUnmatch} (${typeof dbAutoUnmatch}), passed=${passedAutoUnmatch} (${typeof passedAutoUnmatch}), final=${autoUnmatchAfterProactive}`);

  const shouldUnmatch = maxConsecutive > 0 && autoUnmatchAfterProactive && newConsecutiveCount >= maxConsecutive;

  if (shouldUnmatch) {
    console.log(`💔 ${characterName} sent ${maxConsecutive} consecutive proactive messages - triggering unmatch for user ${userId}`);
  } else if (maxConsecutive > 0 && !autoUnmatchAfterProactive && newConsecutiveCount >= maxConsecutive) {
    console.log(`🔔 ${characterName} at consecutive cap (${newConsecutiveCount}/${maxConsecutive}) - auto-unmatch DISABLED by user setting`);
  }

  return { shouldUnmatch, newConsecutiveCount, maxConsecutive };
}

/**
 * Handle unmatch after consecutive proactive messages cap
 */
export function handleProactiveUnmatch(userId, characterId, characterName, conversationId, maxConsecutive, io) {
  // FINAL SAFEGUARD: Re-check setting directly from DB before ANY deletion
  const dbSettings = db.prepare('SELECT auto_unmatch_after_proactive FROM users WHERE id = ?').get(userId);
  const autoUnmatchEnabled = dbSettings?.auto_unmatch_after_proactive === 1 || dbSettings?.auto_unmatch_after_proactive === true;

  // If setting is explicitly disabled (0 or false), abort unmatch
  if (dbSettings?.auto_unmatch_after_proactive === 0 || dbSettings?.auto_unmatch_after_proactive === false) {
    console.log(`🛡️ SAFEGUARD BLOCKED UNMATCH: auto_unmatch_after_proactive is disabled in DB (value: ${dbSettings.auto_unmatch_after_proactive})`);
    console.log(`🛡️ ${characterName} will NOT be unmatched for user ${userId}`);
    return false;
  }

  // If setting is undefined/null but we got here somehow, also block (fail-safe)
  if (dbSettings?.auto_unmatch_after_proactive === undefined || dbSettings?.auto_unmatch_after_proactive === null) {
    console.log(`🛡️ SAFEGUARD WARNING: auto_unmatch_after_proactive is undefined/null, proceeding with caution`);
  }

  console.log(`🔓 Unmatch safeguard passed: auto_unmatch_after_proactive=${dbSettings?.auto_unmatch_after_proactive}`);

  const unmatchReason = `Character unmatched after ${maxConsecutive} consecutive unanswered messages`;

  // Add UNMATCH separator to conversation history
  const unmatchSeparator = `[UNMATCH: ${characterName} unmatched - ${unmatchReason}]`;
  messageService.saveMessage(
    conversationId,
    'system',
    unmatchSeparator,
    null,
    'text',
    null,
    null,
    null,
    false,
    null
  );
  console.log(`✅ Added UNMATCH separator: ${unmatchSeparator}`);

  // Delete character from backend
  db.prepare('DELETE FROM characters WHERE id = ? AND user_id = ?').run(characterId, userId);

  // Emit unmatch event to frontend
  io.to(`user:${userId}`).emit('character_unmatched', {
    characterId: characterId,
    characterName: characterName,
    reason: unmatchReason
  });

  console.log(`✅ Unmatch complete for ${characterName} and user ${userId} (conversation preserved)`);
  return true;
}
