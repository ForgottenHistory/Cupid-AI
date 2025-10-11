/**
 * Get character's current status from schedule
 */
export function getCurrentStatusFromSchedule(schedule) {
  if (!schedule?.schedule) {
    return { status: 'online', activity: null };
  }

  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const todaySchedule = schedule.schedule[currentDay];
  if (!todaySchedule || todaySchedule.length === 0) {
    return { status: 'offline', activity: null };
  }

  // Find the block that contains current time
  for (const block of todaySchedule) {
    // Check if this block crosses midnight (end < start, e.g., 20:00-03:00)
    const crossesMidnight = block.end < block.start;

    let isInBlock;
    if (crossesMidnight) {
      // For midnight wraparound: current time is in block if it's >= start OR < end
      // e.g., 20:00-03:00 matches 21:00, 22:00, 23:00, 00:00, 01:00, 02:00
      isInBlock = currentTime >= block.start || currentTime < block.end;
    } else {
      // Normal case: current time must be between start and end
      isInBlock = currentTime >= block.start && currentTime < block.end;
    }

    if (isInBlock) {
      return {
        status: block.status,
        activity: block.activity || null
      };
    }
  }

  // If no block found, assume offline
  return { status: 'offline', activity: null };
}
