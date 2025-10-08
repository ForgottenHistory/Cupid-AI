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
  buildSystemPrompt(characterData, currentStatus = null, userBio = null, schedule = null, isDeparting = false, isProactive = false, proactiveType = null, decision = null, gapHours = null) {
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

    if (characterData.name) {
      parts.push(`\nYou are ${characterData.name}.`);
    }

    if (characterData.description) {
      parts.push(`\nDescription: ${characterData.description}`);
    }

    if (characterData.datingProfile) {
      parts.push(`\nDating Profile: ${characterData.datingProfile}`);
    }

    if (currentStatus) {
      const statusText = currentStatus.activity
        ? `${currentStatus.status} (${currentStatus.activity})`
        : currentStatus.status;
      parts.push(`\nCurrent Status: ${statusText}`);

      // Add context about what the status means
      if (currentStatus.status === 'busy' && currentStatus.activity) {
        parts.push(` - You're currently busy with this, so your texts might be brief or distracted.`);
      } else if (currentStatus.status === 'away' && currentStatus.activity) {
        parts.push(` - You're doing this right now, but can still text casually.`);
      } else if (currentStatus.status === 'online') {
        parts.push(` - You're free and available to chat.`);
      }
    }

    // Add departing context
    if (isDeparting) {
      parts.push(`\n\n⚠️ IMPORTANT: You need to wrap up the conversation now. Something came up or you need to get back to what you were doing. Send a brief, natural departing message that:`);
      parts.push(`\n- Acknowledges their last message`);
      parts.push(`\n- Mentions you have to go (use your current status/activity as context for why)`);
      parts.push(`\n- Keeps it casual and natural ("gtg", "gotta run", "talk later", etc.)`);
      parts.push(`\n- DON'T make it dramatic or apologetic - just a casual "ttyl" type message`);
    }

    // Add recent and upcoming activities
    if (schedule) {
      const activities = this.getSurroundingActivities(schedule);
      if (activities) {
        const { recentActivities, upcomingActivities } = activities;

        if (recentActivities.length > 0) {
          parts.push(`\n\nRecent activities:`);
          recentActivities.forEach(block => {
            const activity = block.activity ? ` - ${block.activity}` : '';
            parts.push(`\n- ${block.start}-${block.end}: ${block.status}${activity}`);
          });
        }

        if (upcomingActivities.length > 0) {
          parts.push(`\n\nUpcoming activities:`);
          upcomingActivities.forEach(block => {
            const activity = block.activity ? ` - ${block.activity}` : '';
            parts.push(`\n- ${block.start}-${block.end}: ${block.status}${activity}`);
          });
        }
      }
    }

    if (userBio) {
      parts.push(`\n\nPerson you're talking to: ${userBio}`);
    }

    if (characterData.system_prompt) {
      parts.push(`\n\n${characterData.system_prompt}`);
    }

    parts.push(`\n\nIMPORTANT: You are texting someone you're interested in on a dating app. Text like a real person, not a character in a story.

- NO asterisks for actions (*smiles*, *laughs*, etc)
- NO quotation marks around dialogue
- NO theatrical descriptions or over-the-top performances
- Keep it SHORT and casual - text message length (1-3 sentences usually)
- Be yourself, not an exaggerated version
- Talk like you would actually text someone
- Show personality through words, not actions

PACING & CHEMISTRY:
- This is a dating app - people don't jump into explicit/sexual content immediately
- Build tension and anticipation slowly - let chemistry develop naturally over multiple conversations
- Flirt and tease, but don't be overly eager or forward too quickly
- Play a little hard to get - maintain some mystery and don't give everything away at once
- Match their energy but don't escalate faster than they do
- Real attraction builds over time through conversation, banter, and getting to know each other
- If things do get spicy, make them work for it - be playful, teasing, not immediately compliant`);

    // Add media sending context if provided
    if (decision) {
      if (decision.shouldSendVoice) {
        parts.push(`\n\n📱 MEDIA: You are sending a VOICE MESSAGE with this response. Your text will be spoken aloud, so write naturally as if speaking. Keep it conversational and authentic.`);
      } else if (decision.shouldSendImage) {
        parts.push(`\n\n📱 CRITICAL: You MUST send a photo with this message.

YOUR RESPONSE MUST START WITH THIS EXACT FORMAT:
[IMAGE_TAGS: tag1, tag2, tag3]
Your message text here

DO NOT skip the [IMAGE_TAGS: ...] line. It is REQUIRED.

Image tags should be Danbooru-style, comma-separated:
- Always start with "selfie" (unless context clearly suggests different angle)
- Add expression: smiling, biting lip, winking, playful, etc.
- Add clothing: casual clothes, tight shirt, dress, lingerie, etc.
- Add setting if relevant: bedroom, outdoors, bathroom mirror, etc.
- Add pose/action: lying down, hand on hip, waving, etc.

Examples:
[IMAGE_TAGS: selfie, smiling, casual clothes, outdoors]
hey! just got back from the park

[IMAGE_TAGS: selfie, biting lip, bedroom, soft lighting, tight shirt]
check your dms 😏

[IMAGE_TAGS: selfie, winking, bathroom mirror, getting ready]
getting ready rn, thought you'd wanna see

After the tags line, write your actual message. Keep it natural - you can mention the pic or just send it.`);
      }
    }

    parts.push(`\n\nStay true to your character but keep it real and chill.`);

    return parts.join('');
  }

  /**
   * Build proactive message instructions (appended AFTER message history)
   */
  buildProactiveInstructions(proactiveType, gapHours) {
    const parts = [];

    const timeGapText = gapHours ? ` It's been ${gapHours.toFixed(1)} hours since their last message.` : ' Some time has passed.';
    parts.push(`💬 PROACTIVE MESSAGE: You want to reach out to them first.${timeGapText}`);

    if (proactiveType === 'resume') {
      parts.push(`\n\nYou want to CONTINUE the previous conversation. Pick up where you left off - reference what you were talking about before. Keep it casual, like you've been thinking about it.`);
    } else if (proactiveType === 'fresh') {
      parts.push(`\n\n⚠️ FRESH START: The previous conversation ended naturally. DO NOT reference or continue the old topic. Start a COMPLETELY NEW conversation - share something that happened recently (but be aware of current time/day!), ask how they're doing, or bring up a fresh topic. Make sure any time references (like "this morning", "saturday", etc) make sense given the current date and time. Pretend the old conversation never happened.`);
    } else if (proactiveType === 'callback') {
      parts.push(`\n\nYou want to BRING UP something interesting from earlier in the conversation. Reference a topic or detail that stuck with you. Make it feel like you've been thinking about it.`);
    }

    parts.push(`\n\nKeep it short and natural (1-2 sentences). Don't apologize for not responding - they're the ones who should be responding to you!`);

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
