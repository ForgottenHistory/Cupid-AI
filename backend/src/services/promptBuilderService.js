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
  buildSystemPrompt(characterData, currentStatus = null, userBio = null, schedule = null, isDeparting = false, isProactive = false, proactiveType = null, decision = null) {
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

    // Add proactive messaging context
    if (isProactive && proactiveType) {
      parts.push(`\n\n💬 PROACTIVE MESSAGE CONTEXT: You are reaching out to them first after some time has passed.`);

      if (proactiveType === 'resume') {
        parts.push(`\n- Type: RESUME - Continue the previous conversation/topic naturally`);
        parts.push(`\n- Reference what you were talking about before`);
        parts.push(`\n- Keep it casual, like you've been thinking about it`);
      } else if (proactiveType === 'fresh') {
        parts.push(`\n- Type: FRESH START - Begin a new conversation`);
        parts.push(`\n- Don't reference the previous topic (it ended naturally)`);
        parts.push(`\n- Share something new, ask how they're doing, or bring up something you're doing`);
      } else if (proactiveType === 'callback') {
        parts.push(`\n- Type: CALLBACK - Reference something interesting from earlier`);
        parts.push(`\n- Bring up a topic or detail from the previous conversation`);
        parts.push(`\n- Make it feel like you've been thinking about it`);
      }

      parts.push(`\n- Keep it short and natural (1-2 sentences)`);
      parts.push(`\n- Don't apologize for not responding (they're the ones who should be responding to you!)`);
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
        parts.push(`\n\n📱 MEDIA: You are sending a PHOTO/IMAGE with this response (context: ${decision.imageContext || 'selfie'}). You can mention sending it casually if it fits the conversation naturally (e.g., "check your dms", "sending you something", or just send without commentary). Don't be awkward about it - treat it like sending a normal pic.`);
      }
    }

    parts.push(`\n\nStay true to your character but keep it real and chill.`);

    return parts.join('');
  }
}

export default new PromptBuilderService();
