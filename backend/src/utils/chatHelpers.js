/**
 * Get character's current status from schedule
 */
export function getCurrentStatusFromSchedule(schedule) {
  if (!schedule?.schedule) {
    console.log('⚠️  No schedule found, defaulting to online');
    return { status: 'online', activity: null };
  }

  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  console.log(`📅 Schedule check: ${currentDay} ${currentTime}`);

  const todaySchedule = schedule.schedule[currentDay];
  if (!todaySchedule || todaySchedule.length === 0) {
    console.log(`⚠️  No schedule for ${currentDay}, defaulting to offline`);
    return { status: 'offline', activity: null };
  }

  console.log(`📋 Today's schedule (${currentDay}):`, JSON.stringify(todaySchedule, null, 2));

  // Find the block that contains current time
  for (const block of todaySchedule) {
    // Check if this block crosses midnight (end < start, e.g., 20:00-03:00)
    const crossesMidnight = block.end < block.start;

    let isInBlock;
    if (crossesMidnight) {
      // For midnight wraparound: current time is in block if it's >= start OR < end
      // e.g., 20:00-03:00 matches 21:00, 22:00, 23:00, 00:00, 01:00, 02:00
      isInBlock = currentTime >= block.start || currentTime < block.end;
      console.log(`🌙 Midnight block: ${block.start}-${block.end} (${block.status}) | current: ${currentTime} | crosses: true | match: ${isInBlock}`);
    } else {
      // Normal case: current time must be between start and end
      isInBlock = currentTime >= block.start && currentTime < block.end;
      console.log(`⏰ Normal block: ${block.start}-${block.end} (${block.status}) | current: ${currentTime} | crosses: false | match: ${isInBlock}`);
    }

    if (isInBlock) {
      console.log(`✅ Match found: ${block.status} (${block.activity || 'no activity'})`);
      return {
        status: block.status,
        activity: block.activity || null,
        start: block.start,
        end: block.end
      };
    }
  }

  // If no block found, assume offline
  console.log(`❌ No matching block found, defaulting to offline`);
  return { status: 'offline', activity: null, start: null, end: null };
}

/**
 * Wait for specified milliseconds
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
