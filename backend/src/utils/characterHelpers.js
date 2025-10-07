/**
 * Helper functions for character status calculations
 */

/**
 * Calculate current status from schedule
 */
export function calculateCurrentStatus(schedule) {
  if (!schedule?.schedule) {
    return { status: 'online', activity: null, nextChange: null };
  }

  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const todaySchedule = schedule.schedule[currentDay];
  if (!todaySchedule || todaySchedule.length === 0) {
    return { status: 'offline', activity: null, nextChange: null };
  }

  // Find the block that contains current time
  for (const block of todaySchedule) {
    if (currentTime >= block.start && currentTime < block.end) {
      return {
        status: block.status,
        activity: block.activity || null,
        nextChange: block.end
      };
    }
  }

  // If no block found, assume offline
  return { status: 'offline', activity: null, nextChange: null };
}
