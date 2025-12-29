import promptBuilderService from './promptBuilderService.js';
import tokenService from './tokenService.js';

/**
 * Service for building chat completion message arrays
 */
class ChatCompletionBuilder {
  /**
   * Build the final messages array for chat completion
   * @param {Object} options - Build options
   * @returns {Array} Final messages array ready for API
   */
  buildMessages(options) {
    const {
      messages,
      systemPrompt,
      contextWindow,
      maxTokens,
      includeFullSchedule,
      schedule,
      currentStatus,
      characterMood,
      characterState,
      userId,
      isProactive,
      proactiveType,
      gapHours,
      isFirstMessage,
      characterId,
      characterData,
      decision,
      userName,
      useNamePrimer = true
    } = options;

    // Trim messages to fit within context window
    const trimmedMessages = tokenService.trimMessagesToContextWindow(
      messages,
      systemPrompt,
      contextWindow,
      maxTokens
    );

    // Split message history: keep last 5 separate for recency
    // BUT if the message right before the last 5 is a TIME GAP, include it with last 5
    let splitIndex = trimmedMessages.length - 5;

    // Walk backwards from splitIndex to include any TIME GAP messages
    while (splitIndex > 0 &&
           trimmedMessages[splitIndex - 1].role === 'system' &&
           trimmedMessages[splitIndex - 1].content.startsWith('[TIME GAP:')) {
      splitIndex--;
    }

    const last5Messages = trimmedMessages.slice(splitIndex);
    const olderMessages = trimmedMessages.slice(0, splitIndex);

    // Build final messages array
    const finalMessages = [
      { role: 'system', content: systemPrompt }
    ];

    // Include full schedule right after system prompt if enabled
    if (includeFullSchedule && schedule) {
      const fullSchedule = promptBuilderService.buildFullSchedule(schedule);
      if (fullSchedule) {
        finalMessages.push({ role: 'system', content: fullSchedule });
      }
    }

    // Add older conversation history
    finalMessages.push(...olderMessages);

    // Append current date/time reminder
    const timeReminder = this.buildTimeReminder();
    finalMessages.push({ role: 'system', content: timeReminder });

    // Append current status and schedule activities
    const contextMessage = this.buildContextMessage(currentStatus, characterMood, characterState, userId, schedule);
    if (contextMessage) {
      finalMessages.push({ role: 'system', content: contextMessage });
    }

    // Add roleplay reminder
    const roleplayReminder = this.buildRoleplayReminder(last5Messages);
    finalMessages.push({ role: 'system', content: roleplayReminder });

    // Add last 5 messages for maximum recency
    finalMessages.push(...last5Messages);

    // For proactive messages, append instructions
    if (isProactive && proactiveType) {
      const proactiveInstructions = promptBuilderService.buildProactiveInstructions(proactiveType, gapHours, isFirstMessage, userId);
      finalMessages.push({ role: 'system', content: proactiveInstructions });
    }

    // Add character-specific post instructions
    const postInstructions = promptBuilderService.getPostInstructions(characterId);
    if (postInstructions) {
      finalMessages.push({ role: 'system', content: postInstructions });
    }

    // Add character name prompt to prime the response (if enabled)
    if (useNamePrimer) {
      const primeContent = this.buildPrimeContent(characterData, decision);
      finalMessages.push({ role: 'assistant', content: primeContent, prefix: true });
    }

    return { finalMessages, trimmedMessages };
  }

  /**
   * Build the current date/time reminder
   */
  buildTimeReminder() {
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

    return `⏰ IMPORTANT: Current date and time is ${dayOfWeek}, ${month} ${day}, ${year} at ${displayHours}:${minutes} ${ampm}. Make sure any time/day references in your message are accurate!`;
  }

  /**
   * Build context message with status and schedule
   */
  buildContextMessage(currentStatus, characterMood, characterState, userId, schedule) {
    const contextParts = [];

    if (currentStatus) {
      const currentStatusMessage = promptBuilderService.buildCurrentStatus(currentStatus, characterMood, characterState, userId);
      if (currentStatusMessage) {
        contextParts.push(currentStatusMessage);
      }
    }

    if (schedule) {
      const scheduleActivities = promptBuilderService.buildScheduleActivities(schedule);
      if (scheduleActivities) {
        contextParts.push(scheduleActivities);
      }
    }

    return contextParts.length > 0 ? contextParts.join('\n\n') : null;
  }

  /**
   * Build roleplay reminder with time gap awareness
   */
  buildRoleplayReminder(last5Messages) {
    const hasTimeGap = last5Messages.some(msg =>
      msg.role === 'system' && msg.content.startsWith('[TIME GAP:')
    );

    let reminder = '⚠️ CRITICAL - RESUME ROLEPLAY NOW: Write something ENTIRELY NEW that progresses the conversation forward. DO NOT copy, repeat, or paraphrase any previous messages. DO NOT regenerate old content. Stay in character. Write as the character would naturally text in this dating app conversation - no narration, no actions in asterisks, just authentic new messages.';

    if (hasTimeGap) {
      reminder += '\n\n⏰ TIME GAP DETECTED: There was a significant time gap in this conversation. Respond naturally as if time has actually passed. DON\'T immediately continue the old topic - acknowledge the gap, ask what\'s up, or bring up something new. The conversation context may have changed.';
    }

    return reminder;
  }

  /**
   * Build the character name prime content
   */
  buildPrimeContent(characterData, decision) {
    const characterName = characterData.data?.name || characterData.name || 'Character';
    let primeContent = `${characterName}: `;

    if (decision) {
      if (decision.shouldSendImage && decision.imageTags) {
        primeContent = `${characterName}: [IMAGE: ${decision.imageTags}]\n[Now write a short caption to go with this pic.]\n${characterName}: `;
      } else if (decision.shouldSendVoice) {
        primeContent = `${characterName}: [VOICE]\n${characterName}: `;
      }
    }

    return primeContent;
  }
}

export default new ChatCompletionBuilder();
