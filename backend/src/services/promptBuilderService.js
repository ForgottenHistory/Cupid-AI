import { loadPrompts } from '../routes/prompts.js';
import memoryService from './memoryService.js';

class PromptBuilderService {
  /**
   * Get surrounding activities from schedule (3 before, 3 after current)
   */
  getSurroundingActivities(schedule) {
    if (!schedule?.schedule) return null;

    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Build a flat list of all blocks across the week with day labels
    const allBlocks = [];
    for (let i = 0; i < 7; i++) {
      const dayIndex = (now.getDay() + i) % 7;
      const day = dayNames[dayIndex];
      const dayBlocks = schedule.schedule[day] || [];

      dayBlocks.forEach(block => {
        allBlocks.push({
          day: day.charAt(0).toUpperCase() + day.slice(1),
          ...block
        });
      });
    }

    // Find current block index
    let currentBlockIndex = -1;
    for (let i = 0; i < allBlocks.length; i++) {
      const block = allBlocks[i];
      if (block.day.toLowerCase() === currentDay &&
          currentTime >= block.start &&
          currentTime < block.end) {
        currentBlockIndex = i;
        break;
      }
    }

    if (currentBlockIndex === -1) return null;

    // Get 3 blocks before and 3 blocks after
    const recentActivities = [];
    const upcomingActivities = [];

    for (let i = Math.max(0, currentBlockIndex - 3); i < currentBlockIndex; i++) {
      recentActivities.push(allBlocks[i]);
    }

    for (let i = currentBlockIndex + 1; i <= Math.min(allBlocks.length - 1, currentBlockIndex + 3); i++) {
      upcomingActivities.push(allBlocks[i]);
    }

    return { recentActivities, upcomingActivities };
  }

  /**
   * Build system prompt from character data
   */
  buildSystemPrompt(characterData, characterId = null, currentStatus = null, userBio = null, schedule = null, isDeparting = false, isProactive = false, proactiveType = null, decision = null, gapHours = null, matchedDate = null) {
    const parts = [];

    // Add current date and time
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayOfWeek = dayNames[now.getDay()];
    const month = monthNames[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear();
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    parts.push(`Current date and time: ${dayOfWeek}, ${month} ${day}, ${year} at ${displayHours}:${minutes} ${ampm}`);

    // Add days since matched if available
    if (matchedDate) {
      const matched = new Date(matchedDate);
      const daysSinceMatch = Math.floor((now - matched) / (1000 * 60 * 60 * 24));
      if (daysSinceMatch === 0) {
        parts.push(`\nYou matched with them TODAY!`);
      } else if (daysSinceMatch === 1) {
        parts.push(`\nYou matched with them 1 day ago.`);
      } else {
        parts.push(`\nYou matched with them ${daysSinceMatch} days ago.`);
      }
    }

    // Handle v2 card format (nested under .data) or flat format
    const name = characterData.data?.name || characterData.name;
    const description = characterData.data?.description || characterData.description;

    if (name) {
      parts.push(`\nYou are ${name}.`);
    }

    if (description) {
      parts.push(`\nDescription: ${description}`);
    }

    // Handle v2 card format (nested under .data.datingProfile) or flat format
    const datingProfile = characterData.data?.datingProfile || characterData.datingProfile;

    if (datingProfile) {
      // Handle dating profile object or string
      if (typeof datingProfile === 'object') {
        const profile = datingProfile;
        const profileParts = [];

        if (profile.bio) profileParts.push(`Bio: ${profile.bio}`);
        if (profile.age) profileParts.push(`Age: ${profile.age}`);
        if (profile.occupation) profileParts.push(`Occupation: ${profile.occupation}`);
        if (profile.height) profileParts.push(`Height: ${profile.height}`);
        if (profile.bodyType) profileParts.push(`Body Type: ${profile.bodyType}`);
        if (profile.measurements) profileParts.push(`Measurements: ${profile.measurements}`);
        if (profile.interests && profile.interests.length > 0) {
          profileParts.push(`Interests: ${profile.interests.join(', ')}`);
        }
        if (profile.funFacts && profile.funFacts.length > 0) {
          profileParts.push(`Fun Facts: ${profile.funFacts.join(', ')}`);
        }
        if (profile.lookingFor) profileParts.push(`Looking For: ${profile.lookingFor}`);

        if (profileParts.length > 0) {
          parts.push(`\nDating Profile:\n${profileParts.join('\n')}`);
        }
      } else {
        parts.push(`\nDating Profile: ${datingProfile}`);
      }
    }

    // Load prompts from config
    const prompts = loadPrompts();

    // Add departing context
    if (isDeparting) {
      parts.push(`\n\n${prompts.departingPrompt}`);
    }

    if (userBio) {
      parts.push(`\n\nPerson you're talking to: ${userBio}`);
    }

    if (characterData.system_prompt) {
      parts.push(`\n\n${characterData.system_prompt}`);
    }

    parts.push(`\n\n${prompts.contextPrompt}`);

    parts.push(`\n\n${prompts.systemPrompt}`);

    // Add memories if available
    if (characterId) {
      const memories = memoryService.getCharacterMemories(characterId);
      if (memories.length > 0) {
        parts.push(`\n\nWHAT YOU REMEMBER ABOUT THEM:\n${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}`);
      }
    }

    // Add media sending context if provided
    if (decision) {
      if (decision.shouldSendVoice) {
        parts.push(`\n\n${prompts.voiceMessagePrompt}`);
      }
      // Note: Image sending is now handled via inline [IMAGE: tags] in the final message primer
    }

    parts.push(`\n\n${prompts.closingPrompt}`);

    return parts.join('');
  }

  /**
   * Build current status message (separate from main prompt for better positioning)
   */
  buildCurrentStatus(currentStatus) {
    if (!currentStatus) return null;

    const parts = [];

    // Build status text with time range
    let statusText = currentStatus.activity
      ? `${currentStatus.status} (${currentStatus.activity})`
      : currentStatus.status;

    // Add time range if available
    if (currentStatus.start && currentStatus.end) {
      statusText = `${currentStatus.start}-${currentStatus.end}: ${statusText}`;
    }

    parts.push(`Current Status: ${statusText}`);

    // Add context about what the status means
    if (currentStatus.status === 'busy' && currentStatus.activity) {
      parts.push(` - You're currently busy with this, so your texts might be brief or distracted.`);
    } else if (currentStatus.status === 'away' && currentStatus.activity) {
      parts.push(` - You're doing this right now, but can still text casually.`);
    } else if (currentStatus.status === 'online') {
      parts.push(` - You're free and available to chat.`);
    }

    return parts.join('');
  }

  /**
   * Build schedule activities message (separate from main prompt for better positioning)
   */
  buildScheduleActivities(schedule) {
    if (!schedule) return null;

    const activities = this.getSurroundingActivities(schedule);
    if (!activities) return null;

    const { recentActivities, upcomingActivities } = activities;
    const parts = [];

    if (recentActivities.length > 0) {
      parts.push('Recent activities:');
      recentActivities.forEach(block => {
        const activity = block.activity ? ` - ${block.activity}` : '';
        parts.push(`- ${block.start}-${block.end}: ${block.status}${activity}`);
      });
    }

    if (upcomingActivities.length > 0) {
      if (parts.length > 0) parts.push(''); // Single blank line separator
      parts.push('Upcoming activities:');
      upcomingActivities.forEach(block => {
        const activity = block.activity ? ` - ${block.activity}` : '';
        parts.push(`- ${block.start}-${block.end}: ${block.status}${activity}`);
      });
    }

    return parts.length > 0 ? parts.join('\n') : null;
  }

  /**
   * Build proactive message instructions (appended AFTER message history)
   */
  buildProactiveInstructions(proactiveType, gapHours, isFirstMessage = false) {
    const parts = [];
    const prompts = loadPrompts();

    // Special handling for first messages (icebreakers)
    if (isFirstMessage) {
      const timeSinceMatch = gapHours ? ` It's been ${gapHours.toFixed(1)} hours since you matched.` : ' You matched recently.';
      parts.push(`💬 FIRST MESSAGE: You're reaching out for the first time!${timeSinceMatch}`);
      parts.push(`\n\n${prompts.proactiveFirstMessagePrompt}`);

      return parts.join('');
    }

    // Special handling for left-on-read
    if (proactiveType === 'left_on_read') {
      parts.push(`👀 LEFT ON READ: They read your message but haven't responded yet. It's been a few minutes.`);
      parts.push(`\n\n${prompts.leftOnReadPrompt}`);
      return parts.join('');
    }

    // Normal proactive message handling - always start fresh
    const timeGapText = gapHours ? ` It's been ${gapHours.toFixed(1)} hours since their last message.` : ' Some time has passed.';
    parts.push(`💬 PROACTIVE MESSAGE: You want to reach out to them first.${timeGapText}`);

    // Always use fresh prompt
    parts.push(`\n\n${prompts.proactiveFreshPrompt}`);
    parts.push(`\n\n${prompts.proactiveClosingPrompt}`);

    // Add time-specific guidance
    if (gapHours) {
      if (gapHours < 3) {
        parts.push(`\nThe time gap is short - keep it casual and immediate, like you just thought of it.`);
      } else if (gapHours < 12) {
        parts.push(`\nSeveral hours have passed - you can reference "earlier" or "this morning/afternoon" if natural.`);
      } else if (gapHours < 24) {
        parts.push(`\nIt's been most of a day - you can acknowledge the time gap naturally if it fits.`);
      } else {
        parts.push(`\nIt's been over a day - you can reference "yesterday" or the time gap if it feels natural.`);
      }
    }

    return parts.join('');
  }
}

export default new PromptBuilderService();
