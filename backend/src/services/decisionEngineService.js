import llmSettingsService from './llmSettingsService.js';

class DecisionEngineService {
  constructor() {
    // aiService will be lazy-loaded to avoid circular dependency
    this.aiService = null;
  }

  /**
   * Lazy-load aiService to avoid circular dependency
   */
  async getAIService() {
    if (!this.aiService) {
      const module = await import('./aiService.js');
      this.aiService = module.default;
    }
    return this.aiService;
  }

  /**
   * Decision Engine: Analyze conversation and decide on actions
   * Returns: { reaction: string|null, shouldRespond: boolean, shouldUnmatch: boolean, shouldSendVoice: boolean, shouldSendImage: boolean, mood: string, thought: string|null, imageContext: string|null }
   */
  async makeDecision({ messages, characterData, userMessage, userId, isEngaged = false, hasVoice = false, hasImage = false, lastMoodChange = null, assistantMessageCount = 0 }) {
    try {
      const aiService = await this.getAIService();
      // Check mood cooldown (30 minutes)
      const moodCooldownMs = 30 * 60 * 1000; // 30 minutes
      const canChangeMood = !lastMoodChange || (Date.now() - new Date(lastMoodChange).getTime() >= moodCooldownMs);

      // Log cooldown status for debugging
      if (lastMoodChange) {
        const timeSinceLastMood = Date.now() - new Date(lastMoodChange).getTime();
        const minutesSince = (timeSinceLastMood / 60000).toFixed(1);
        console.log(`🎨 Last mood change: ${minutesSince} min ago (cooldown: ${canChangeMood ? 'expired' : 'active'})`);
      } else {
        console.log(`🎨 No previous mood change detected`);
      }

      const decisionSettings = llmSettingsService.getDecisionSettings(userId);

      // Check if this is a thought message (every 10th message)
      const shouldGenerateThought = (assistantMessageCount + 1) % 10 === 0;

      if (shouldGenerateThought) {
        console.log(`💭 Decision Engine: Thought will be requested (message ${assistantMessageCount + 1})`);
      }

      // Get personality data if available
      let personalityContext = '';
      if (characterData.personality_data) {
        try {
          const personality = JSON.parse(characterData.personality_data);
          personalityContext = `\nPersonality Traits:
- Extraversion: ${personality.extraversion}/100 (${personality.extraversion > 60 ? 'outgoing, expressive' : 'reserved, thoughtful'})
- Openness: ${personality.openness}/100 (${personality.openness > 60 ? 'experimental, creative' : 'traditional, practical'})`;
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Build decision prompt (plaintext output)
      const decisionPrompt = `You are a decision-making AI that analyzes dating app conversations and decides how the character should respond.

Character: ${characterData.name}
Description: ${characterData.description || 'N/A'}${personalityContext}
${isEngaged ? '\nCurrent state: Character is actively engaged in conversation (responding quickly)' : '\nCurrent state: Character is disengaged (slower responses based on availability)'}
${hasVoice ? '\nVoice available: This character has a voice sample and can send voice messages' : '\nVoice available: No (text only)'}
${hasImage ? '\nImage generation: This character has image tags configured and can send generated images' : '\nImage generation: No'}

Recent conversation context:
${messages.slice(-3).map(m => `${m.role === 'user' ? 'User' : characterData.name}: ${m.content}`).join('\n')}

User just sent: "${userMessage}"

Decide on the character's behavioral response. Output your decision in this EXACT plaintext format:

Reaction: [emoji or "none"]
Should Respond: [yes/no]
Should Unmatch: [yes/no]
${hasVoice ? 'Send Voice: [yes/no]\n' : ''}${hasImage ? 'Send Image: [yes/no]\n' : ''}Mood: [none/hearts/stars/laugh/sparkles/fire/roses]
${shouldGenerateThought ? 'Thought: [internal monologue - 1-2 sentences about how character feels about the conversation]\n' : ''}Reason: [brief explanation in one sentence]

Guidelines:
- "Reaction": IMPORTANT - Reactions should be RARE (only 1 in 5 messages or less). Only react to messages that are genuinely funny, sweet, exciting, or emotionally significant. Most messages should get "none". Don't react to every message!
- If you do react, choose ONE emoji that represents a strong emotional reaction (❤️, 😂, 🔥, 😍, 😭, etc.)
- "Should Respond": Always "yes" for now (we will expand this later)
- "Should Unmatch": EXTREMELY RARE - Only "yes" if the user is being:
  * Extremely annoying
  * Persistently ignoring boundaries after warnings
  * Not fulfilling character's needs in any way
  This should almost NEVER be "yes" - reserve it for serious violations only. Normal awkwardness, bad jokes, or being boring should NOT trigger unmatch.${hasVoice ? `
- "Send Voice": Should be OCCASIONAL, not every message. Consider:
  * Personality: High extraversion/openness = more likely to use voice
  * Context: Emotional moments, excitement, longer responses = more voice
  * Variety: Don't overuse voice - text is default, voice is special
  * Quick replies: Usually text
  * Deep/heartfelt messages: More likely voice` : ''}${hasImage ? `
- "Send Image": Consider context carefully. Send image when:
  * User directly asks for a photo/pic/selfie → Usually YES
  * Character wants to show what they're doing/wearing → YES if relevant
  * Flirty moment where visual would enhance chemistry → Consider YES
  * Sharing a moment (food, location, outfit, activity) → Consider YES
  * Random messages with no visual context → NO
  * Early conversation before rapport built → Usually NO
  * Personality: High openness/extraversion = more likely to send spontaneous pics
  Images should feel natural to the conversation flow, not forced or random.` : ''}
- "Mood": ${canChangeMood ? 'CRITICAL: Mood changes should be EXTREMELY RARE - only 1 in 20+ messages or less. Default is "none".' : 'MOOD COOLDOWN ACTIVE - You MUST set this to "none". The mood was recently changed and cannot be changed again yet.'}${canChangeMood ? `
  * "none" - DEFAULT - Use this 95%+ of the time. Most conversations don't need mood changes!
  * "hearts" - ONLY for major romantic breakthroughs (first "I love you", intimate confession)
  * "stars" - ONLY for truly shocking/amazing news (won lottery, dream job offer)
  * "laugh" - ONLY for genuinely hilarious moments that made you laugh out loud
  * "sparkles" - ONLY for magical once-in-a-lifetime moments
  * "fire" - ONLY for intensely passionate/spicy exchanges
  * "roses" - ONLY for deeply tender, vulnerable emotional moments

  WARNING: Setting a mood is a BIG DEAL. If you're unsure, use "none". Moods should feel special and rare, not common. Think: "Would this moment stand out in a month?" If no, use "none".` : ''}${shouldGenerateThought ? `
- "Thought": This is the character's internal monologue - what they're REALLY thinking/feeling about the conversation.
  * Keep it 1-2 sentences max
  * Be honest about their feelings (interest, confusion, attraction, concern, excitement, etc.)
  * Can reveal things they wouldn't say out loud
  * Examples: "He's really sweet, but I'm not sure if he's just being polite or actually interested." / "This conversation is so easy and fun - I could talk to him for hours."` : ''}

Output ONLY the ${shouldGenerateThought ? (hasVoice && hasImage ? 'eight' : hasVoice || hasImage ? 'seven' : 'six') : (hasVoice && hasImage ? 'seven' : hasVoice || hasImage ? 'six' : 'five')} lines in the exact format shown above, nothing else.`;

      console.log('🎯 Decision Engine Request:', {
        model: decisionSettings.model,
        temperature: decisionSettings.temperature,
        max_tokens: decisionSettings.max_tokens
      });

      const response = await aiService.createBasicCompletion(decisionPrompt, {
        model: decisionSettings.model,
        temperature: decisionSettings.temperature,
        max_tokens: decisionSettings.max_tokens,
        top_p: decisionSettings.top_p,
        frequency_penalty: decisionSettings.frequency_penalty,
        presence_penalty: decisionSettings.presence_penalty,
        messageType: 'decision',
        characterName: characterData.name
      });

      const content = response.content.trim();

      console.log('✅ Decision Engine Response:', {
        model: response.model,
        usage: response.usage,
        rawContent: content // Add raw content for debugging
      });

      // Parse plaintext response
      const decision = this.parseDecisionResponse(content);

      // Enforce mood cooldown (override LLM decision if on cooldown)
      if (!canChangeMood && decision.mood !== 'none') {
        console.log(`🚫 Mood change BLOCKED by cooldown (LLM wanted: ${decision.mood}, last change: ${lastMoodChange})`);
        decision.mood = 'none';
      } else if (decision.mood !== 'none') {
        console.log(`✅ Mood change ALLOWED: ${decision.mood} (cooldown expired)`);
      }

      return decision;
    } catch (error) {
      console.error('❌ Decision Engine error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      // On error, fail gracefully: no reaction, but respond, don't unmatch
      return this.getDefaultDecision();
    }
  }

  /**
   * Proactive Decision Engine: Decide if character should send proactive message
   * Returns: { shouldSend: boolean, messageType: "resume"|"fresh"|"callback" }
   */
  async makeProactiveDecision({ messages, characterData, gapHours, userId }) {
    try {
      const aiService = await this.getAIService();
      const decisionSettings = llmSettingsService.getDecisionSettings(userId);

      // Build context
      const lastMessages = messages.slice(-5);

      const decisionPrompt = `You are deciding if this character should proactively send a message on a dating app.

Character: ${characterData.name}
Description: ${characterData.description || 'N/A'}

Time since last message: ${gapHours.toFixed(1)} hours

Recent conversation:
${lastMessages.map(m => `${m.role === 'user' ? 'User' : characterData.name}: ${m.content}`).join('\n')}

IMPORTANT: The default should be YES - characters WANT to talk to people they're interested in. Only say NO if there's a specific reason not to reach out.

Check for these specific NO conditions:
1. Did EITHER person set a specific time to talk? ("text me at 5", "I'll message you tomorrow", "talk later tonight")
2. Did EITHER person say they're busy and will reach out when free? ("I'll text you later", "I'll message you when I'm done")
3. Is there an unresolved timing expectation from EITHER side that hasn't been met yet?

If NONE of these apply → Say YES (the character wants to reach out!)

Output your decision in this EXACT format:

Should Send: [yes/no]
Message Type: [resume/fresh/callback]
Reason: [brief explanation in one sentence]

Guidelines:
- "Should Send":
  * YES by default - characters like talking to matches
  * NO ONLY if either person set a specific timing expectation that hasn't been met
  * NO ONLY if either person said they'll reach out first and not enough time has passed
  * Don't overthink it - if there's no explicit reason to wait, say YES
- "Message Type":
  * "resume" - Continue the previous topic (if conversation was mid-flow)
  * "fresh" - Start a new conversation (if enough time has passed or topic ended)
  * "callback" - Reference something from earlier (if there was an interesting point to revisit)
- "Reason":
  * Explain why you decided to send or not send
  * Keep it brief (one sentence)

Output ONLY the three lines in the exact format shown above, nothing else.`;

      console.log('🎯 Proactive Decision Engine Request:', {
        model: decisionSettings.model,
        gapHours: gapHours.toFixed(1)
      });

      const response = await aiService.createBasicCompletion(decisionPrompt, {
        model: decisionSettings.model,
        temperature: decisionSettings.temperature,
        max_tokens: decisionSettings.max_tokens,
        top_p: decisionSettings.top_p,
        frequency_penalty: decisionSettings.frequency_penalty,
        presence_penalty: decisionSettings.presence_penalty,
        messageType: 'decision-proactive',
        characterName: characterData.name
      });

      const content = response.content.trim();

      // Parse response
      return this.parseProactiveDecisionResponse(content);
    } catch (error) {
      console.error('❌ Proactive Decision Engine error:', error.message);
      // On error, don't send
      return this.getDefaultProactiveDecision();
    }
  }

  /**
   * Parse decision response
   */
  parseDecisionResponse(content) {
    try {
      const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const decision = {
        reaction: null,
        shouldRespond: true,
        shouldUnmatch: false,
        shouldSendVoice: false,
        shouldSendImage: false,
        mood: 'none',
        thought: null,
        reason: 'No reason provided'
      };

      for (const line of lines) {
        if (line.startsWith('Reaction:')) {
          const value = line.substring('Reaction:'.length).trim();
          // If it's "none" or empty, keep null. Otherwise use the emoji
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
      return this.getDefaultDecision();
    }
  }

  /**
   * Parse proactive decision response
   */
  parseProactiveDecisionResponse(content) {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const decision = {
      shouldSend: false,
      messageType: 'fresh',
      reason: 'No reason provided'
    };

    for (const line of lines) {
      if (line.startsWith('Should Send:')) {
        const value = line.substring('Should Send:'.length).trim().toLowerCase();
        decision.shouldSend = value === 'yes';
      } else if (line.startsWith('Message Type:')) {
        const value = line.substring('Message Type:'.length).trim().toLowerCase();
        if (['resume', 'fresh', 'callback'].includes(value)) {
          decision.messageType = value;
        }
      } else if (line.startsWith('Reason:')) {
        decision.reason = line.substring('Reason:'.length).trim();
      }
    }

    return decision;
  }

  /**
   * Get default decision (fallback)
   */
  getDefaultDecision() {
    return {
      reaction: null,
      shouldRespond: true,
      shouldUnmatch: false,
      shouldSendVoice: false,
      shouldSendImage: false,
      mood: 'none',
      thought: null,
      reason: 'Default decision (fallback)'
    };
  }

  /**
   * Get default proactive decision (fallback)
   */
  getDefaultProactiveDecision() {
    return {
      shouldSend: false,
      messageType: 'fresh',
      reason: 'Decision engine error - defaulting to not sending'
    };
  }
}

export default new DecisionEngineService();
