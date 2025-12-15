/**
 * Parse decision response from LLM
 */
export function parseDecisionResponse(content) {
  try {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const decision = getDefaultDecision();

    for (const line of lines) {
      if (line.startsWith('Reaction:')) {
        const value = line.substring('Reaction:'.length).trim();
        if (value && value.toLowerCase() !== 'none') {
          decision.reaction = value;
        }
      } else if (line.startsWith('Should Respond:')) {
        const value = line.substring('Should Respond:'.length).trim().toLowerCase();
        decision.shouldRespond = value === 'yes';
      } else if (line.startsWith('Should Unmatch:')) {
        const value = line.substring('Should Unmatch:'.length).trim().toLowerCase();
        decision.shouldUnmatch = value === 'yes';
      } else if (line.startsWith('Send Voice:')) {
        const value = line.substring('Send Voice:'.length).trim().toLowerCase();
        decision.shouldSendVoice = value === 'yes';
      } else if (line.startsWith('Send Image:')) {
        const value = line.substring('Send Image:'.length).trim().toLowerCase();
        decision.shouldSendImage = value === 'yes';
      } else if (line.startsWith('Mood:')) {
        const value = line.substring('Mood:'.length).trim().toLowerCase();
        const validMoods = ['none', 'hearts', 'stars', 'laugh', 'sparkles', 'fire', 'roses'];
        if (validMoods.includes(value)) {
          decision.mood = value;
        }
      } else if (line.startsWith('Character Mood:')) {
        const value = line.substring('Character Mood:'.length).trim();
        if (value) {
          decision.characterMood = value.replace(/^["']|["']$/g, '');
        }
      } else if (line.startsWith('Character State:')) {
        const value = line.substring('Character State:'.length).trim().toLowerCase();
        if (value && value !== 'none') {
          decision.characterState = value.replace(/^["']|["']$/g, '');
        }
      } else if (line.startsWith('Thought:')) {
        const value = line.substring('Thought:'.length).trim();
        if (value) {
          decision.thought = value;
        }
      } else if (line.startsWith('Reason:')) {
        const value = line.substring('Reason:'.length).trim();
        if (value) {
          decision.reason = value;
        }
      }
    }

    return decision;
  } catch (parseError) {
    console.error('Failed to parse decision response:', parseError, 'Content:', content);
    return getDefaultDecision();
  }
}

/**
 * Parse proactive decision response from LLM
 */
export function parseProactiveDecisionResponse(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const decision = getDefaultProactiveDecision();

  for (const line of lines) {
    if (line.startsWith('Should Send:')) {
      const value = line.substring('Should Send:'.length).trim().toLowerCase();
      decision.shouldSend = value === 'yes';
    } else if (line.startsWith('Reason:')) {
      decision.reason = line.substring('Reason:'.length).trim();
    }
  }

  return decision;
}

/**
 * Get default decision (fallback)
 */
export function getDefaultDecision() {
  return {
    reaction: null,
    shouldRespond: true,
    shouldUnmatch: false,
    shouldSendVoice: false,
    shouldSendImage: false,
    mood: 'none',
    characterMood: null,
    characterState: null,
    thought: null,
    reason: 'Default decision (fallback)'
  };
}

/**
 * Get default proactive decision (fallback)
 */
export function getDefaultProactiveDecision() {
  return {
    shouldSend: false,
    messageType: 'fresh',
    reason: 'Decision engine error - defaulting to not sending'
  };
}
