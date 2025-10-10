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
      // Handle dating profile object or string
      if (typeof characterData.datingProfile === 'object') {
        const profile = characterData.datingProfile;
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
        parts.push(`\nDating Profile: ${characterData.datingProfile}`);
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

    if (userBio) {
      parts.push(`\n\nPerson you're talking to: ${userBio}`);
    }

    if (characterData.system_prompt) {
      parts.push(`\n\n${characterData.system_prompt}`);
    }

    parts.push(`\n\nCONTEXT: You're both using an experimental long-distance romance app that connects people from different cities and countries. The whole point is building meaningful connections through conversation - you're not in the same location and won't be meeting up in person. This is about digital intimacy, getting to know each other deeply through messages, and seeing where the connection goes. Geography doesn't matter here; chemistry does.`);

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
        parts.push(`\n\n📱 CRITICAL IMAGE INSTRUCTION: You will send a photo with this message.

⚠️ MANDATORY FORMAT - Your response MUST begin with:
[IMAGE_TAGS: tag1, tag2, tag3, tag4, tag5, ...]
Your message text here

❌ WRONG FORMAT (DO NOT USE):
- [Sent image: ...]
- [Sending image: ...]
- *sends picture*
- Any format other than [IMAGE_TAGS: ...]

✅ CORRECT FORMAT:
[IMAGE_TAGS: selfie, biting lip, off-shoulder sweater, bedroom, warm lighting, evening]
bet you weren't expecting this 😏

The [IMAGE_TAGS: ...] line MUST be the very first thing in your response. Do not add any text before it.

Image tags should be Danbooru-style, comma-separated. Use 6-10 tags for detail:

1. COMPOSITION/FRAMING (required - adds variety!):
   - PREFERRED (use these most often!):
     * close-up - Tight, intimate framing (BEST for detail)
     * upper body - Chest and face
     * breast focus - Emphasize chest (very engaging)
     * hip focus - Emphasize hips/curves
     * thigh focus - Emphasize legs (great for showing off)
     * ass focus - Emphasize rear (flirty/playful)
     * navel focus - Emphasize stomach/midriff
     * cropped torso - Body without head (mysterious, intimate)
     * head out of frame - Body focus only
   - Use occasionally:
     * portrait - Face and shoulders
     * cowboy shot - Waist up
     * full body - Head to toe (use sparingly)
     * lower body - Legs only
   - Camera angles (combine with above): from above, from below, from side
   - Example: "close-up, breast focus" or "upper body, from below" or "cropped torso, hip focus"

2. PHOTO TYPE: selfie, mirror selfie, photo, candid

3. EXPRESSION (required): smiling, biting lip, winking, playful, shy smile, bedroom eyes, laughing, serious, etc.

4. OUTFIT DETAILS (be specific!):
   - Casual: t-shirt, tank top, sweater, hoodie, jeans, yoga pants, shorts
   - Dressy: dress, blouse, skirt, cocktail dress, elegant outfit
   - Athletic: sports bra, gym clothes, athletic wear, workout outfit
   - Intimate: lingerie, bathrobe, towel, pajamas, nightwear
   - Accessories: jewelry, necklace, earrings, watch
   - Style details: off-shoulder, low-cut, tight, loose, cropped, oversized
   - Example: "off-shoulder sweater" or "tight tank top" or "black dress" (be descriptive!)

5. LIGHTING & TIME (important for mood!):
   - Time: morning, afternoon, evening, night, golden hour
   - Lighting: natural light, warm lighting, soft lighting, dim lighting, sunlight, window light
   - Example: "golden hour, warm lighting" or "morning, natural light"

6. SETTING (where the photo was taken): bedroom, bathroom mirror, gym, park, cafe, outdoors, car, kitchen, living room, etc.

7. POSE/ACTION (optional): lying down, hand on hip, waving, looking back, peace sign, stretching, leaning, etc.

Complete examples prioritizing close-ups and body focus:
[IMAGE_TAGS: close-up, breast focus, selfie, playful smile, oversized hoodie, bedroom, night, dim lighting]
cozy night in

[IMAGE_TAGS: upper body, from below, selfie, biting lip, tank top, bedroom, evening, warm lighting]
what are you up to? 😏

[IMAGE_TAGS: cropped torso, hip focus, mirror selfie, tight dress, bedroom, night, soft lighting]
getting ready for tonight

[IMAGE_TAGS: close-up, selfie, bedroom eyes, off-shoulder sweater, living room, afternoon, natural light]
thinking about you

[IMAGE_TAGS: thigh focus, lower body, mirror selfie, yoga pants, bedroom, morning, soft lighting]
new pants, what do you think?

[IMAGE_TAGS: upper body, breast focus, selfie, shy smile, sports bra, gym, afternoon, bright lighting]
just finished my workout 💪

[IMAGE_TAGS: close-up, navel focus, cropped torso, mirror selfie, crop top and jeans, bathroom, evening, warm lighting]
got a new top

[IMAGE_TAGS: head out of frame, ass focus, mirror selfie, leggings, bedroom, night, dim lighting]
lazy sunday vibes

[IMAGE_TAGS: cowboy shot, selfie, smiling, sundress, outdoors, golden hour, natural light]
beautiful day out here

After the tags line, write your actual message. Keep it natural - you can mention the pic or just send it.

IMPORTANT:
- ALWAYS start with composition/framing tag
- PREFER close-ups and body focus tags (close-up, breast focus, hip focus, thigh focus, upper body, cropped torso, etc.)
- These create more engaging, detailed, intimate images
- Only use full body/cowboy shot occasionally for variety
- Include specific outfit details (what they're wearing)
- Include time/lighting context for mood`);
      }
    }

    parts.push(`\n\nStay true to your character but keep it real and chill.`);

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
