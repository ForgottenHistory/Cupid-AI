import llmSettingsService from './llmSettingsService.js';
import promptBuilderService from './promptBuilderService.js';

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
  async makeDecision({ messages, characterData, characterId = null, userMessage, userId, isEngaged = false, hasVoice = false, hasImage = false, lastMoodChange = null, assistantMessageCount = 0, currentStatus = null, schedule = null, userBio = null }) {
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

      // Extract character name
      const characterName = characterData.data?.name || characterData.name || 'Character';

      // Build system prompt (same as chat) - include characterId for memories
      const systemPrompt = promptBuilderService.buildSystemPrompt(characterData, characterId, currentStatus, userBio, schedule, false, false, null, null, null, null, 'User');

      // Format conversation history (same format as chat prompt, includes TIME GAPs)
      const conversationHistory = messages.map(m => {
        if (m.role === 'system') {
          return m.content; // TIME GAP markers, summaries, etc.
        }
        return `${m.role === 'user' ? 'User' : characterName}: ${m.content}`;
      }).join('\n');

      // Load decision prompt from config
      const { loadPrompts } = await import('../routes/prompts.js');
      const prompts = loadPrompts();

      // Build decision prompt with dynamic replacements
      let decisionPromptTemplate = prompts.decisionPrompt;

      // Replace conditional sections
      decisionPromptTemplate = decisionPromptTemplate.replace(
        '{hasVoice}',
        hasVoice ? '' : '##REMOVE_VOICE##'
      );
      decisionPromptTemplate = decisionPromptTemplate.replace(
        '{hasImage}',
        hasImage ? '' : '##REMOVE_IMAGE##'
      );
      decisionPromptTemplate = decisionPromptTemplate.replace(
        '{shouldGenerateThought}',
        shouldGenerateThought ? '' : '##REMOVE_THOUGHT##'
      );

      // Remove conditional guideline sections
      if (!hasVoice) {
        decisionPromptTemplate = decisionPromptTemplate.replace(/\{voiceGuidelines\}[^\{]*/g, '');
      } else {
        decisionPromptTemplate = decisionPromptTemplate.replace('{voiceGuidelines}', '\n');
      }

      if (!hasImage) {
        decisionPromptTemplate = decisionPromptTemplate.replace(/\{imageGuidelines\}[^\{]*/g, '');
      } else {
        decisionPromptTemplate = decisionPromptTemplate.replace('{imageGuidelines}', '\n');
      }

      // Mood cooldown message
      const moodCooldownMsg = canChangeMood
        ? ''
        : 'MOOD COOLDOWN ACTIVE - You MUST set this to "none". The mood was recently changed and cannot be changed again yet. ';
      decisionPromptTemplate = decisionPromptTemplate.replace('{moodCooldownMessage}', moodCooldownMsg);

      if (canChangeMood) {
        decisionPromptTemplate = decisionPromptTemplate.replace('{moodGuidelines}', '\n');
      } else {
        // Remove mood guidelines section when on cooldown
        decisionPromptTemplate = decisionPromptTemplate.replace(/\{moodGuidelines\}[^\{]*/g, '');
      }

      if (!shouldGenerateThought) {
        decisionPromptTemplate = decisionPromptTemplate.replace(/\{thoughtGuidelines\}[^\{]*/g, '');
      } else {
        decisionPromptTemplate = decisionPromptTemplate.replace('{thoughtGuidelines}', '\n');
      }

      // Remove marker lines
      decisionPromptTemplate = decisionPromptTemplate.replace(/##REMOVE_VOICE##[^\n]*\n?/g, '');
      decisionPromptTemplate = decisionPromptTemplate.replace(/##REMOVE_IMAGE##[^\n]*\n?/g, '');
      decisionPromptTemplate = decisionPromptTemplate.replace(/##REMOVE_THOUGHT##[^\n]*\n?/g, '');

      const decisionPrompt = `${systemPrompt}

${personalityContext}
${isEngaged ? '\nCurrent state: Character is actively engaged in conversation (responding quickly)' : '\nCurrent state: Character is disengaged (slower responses based on availability)'}
${hasVoice ? '\nVoice available: This character has a voice sample and can send voice messages' : '\nVoice available: No (text only)'}
${hasImage ? '\nImage generation: This character has image tags configured and can send generated images' : '\nImage generation: No'}

Conversation history:
${conversationHistory}

User just sent: "${userMessage}"

${decisionPromptTemplate}`;

      console.log('🎯 Decision Engine Request:', {
        model: decisionSettings.model,
        temperature: decisionSettings.temperature,
        max_tokens: decisionSettings.max_tokens
      });

      const response = await aiService.createBasicCompletion(decisionPrompt, {
        userId: userId,
        provider: decisionSettings.provider,
        model: decisionSettings.model,
        temperature: decisionSettings.temperature,
        max_tokens: decisionSettings.max_tokens,
        top_p: decisionSettings.top_p,
        frequency_penalty: decisionSettings.frequency_penalty,
        presence_penalty: decisionSettings.presence_penalty,
        top_k: decisionSettings.top_k,
        repetition_penalty: decisionSettings.repetition_penalty,
        min_p: decisionSettings.min_p,
        messageType: 'decision',
        characterName: characterName
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
   * Returns: { shouldSend: boolean, messageType: "fresh", reason: string }
   */
  async makeProactiveDecision({ messages, characterData, characterId = null, gapHours, userId, currentStatus = null, schedule = null, userBio = null }) {
    try {
      const aiService = await this.getAIService();
      const decisionSettings = llmSettingsService.getDecisionSettings(userId);

      // Extract character name
      const characterName = characterData.data?.name || characterData.name || 'Character';

      // Build system prompt (same as chat) - include characterId for memories
      const systemPrompt = promptBuilderService.buildSystemPrompt(characterData, characterId, currentStatus, userBio, schedule, false, false, null, null, null, null, 'User');

      // Format conversation history (same format as chat prompt, includes TIME GAPs)
      const conversationHistory = messages.map(m => {
        if (m.role === 'system') {
          return m.content; // TIME GAP markers, summaries, etc.
        }
        return `${m.role === 'user' ? 'User' : characterName}: ${m.content}`;
      }).join('\n');

      // Load prompts from config
      const { loadPrompts } = await import('../routes/prompts.js');
      const prompts = loadPrompts();

      const decisionPrompt = `${systemPrompt}

Time since last message: ${gapHours.toFixed(1)} hours

Conversation history:
${conversationHistory}

${prompts.proactiveFreshPrompt}

${prompts.proactiveDecisionPrompt}`;

      console.log('🎯 Proactive Decision Engine Request:', {
        model: decisionSettings.model,
        gapHours: gapHours.toFixed(1)
      });

      const response = await aiService.createBasicCompletion(decisionPrompt, {
        userId: userId,
        provider: decisionSettings.provider,
        model: decisionSettings.model,
        temperature: decisionSettings.temperature,
        max_tokens: decisionSettings.max_tokens,
        top_p: decisionSettings.top_p,
        frequency_penalty: decisionSettings.frequency_penalty,
        presence_penalty: decisionSettings.presence_penalty,
        top_k: decisionSettings.top_k,
        repetition_penalty: decisionSettings.repetition_penalty,
        min_p: decisionSettings.min_p,
        messageType: 'decision-proactive',
        characterName: characterName
      });

      const content = response.content.trim();

      // Parse response - always returns 'fresh' message type
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
      messageType: 'fresh', // Always 'fresh' now
      reason: 'No reason provided'
    };

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

  /**
   * Left-On-Read Decision Engine: Decide if character should follow up when user reads but doesn't respond
   * Returns: { shouldSend: boolean, messageType: "left_on_read", reason: string }
   */
  async makeLeftOnReadDecision({ messages, characterData, personality, minutesSinceRead, userId }) {
    try {
      const aiService = await this.getAIService();
      const decisionSettings = llmSettingsService.getDecisionSettings(userId);

      // Build context
      const lastMessages = messages.slice(-5);

      // Extract character name and description (handle v2 card format)
      const characterName = characterData.data?.name || characterData.name || 'Character';
      const characterDescription = characterData.data?.description || characterData.description || 'N/A';

      // Calculate personality influence on probability
      const extraversion = personality?.extraversion || 50;
      const neuroticism = personality?.neuroticism || 50;

      // High extraversion/neuroticism = more likely to follow up
      let personalityGuidance = '';
      if (extraversion > 70 || neuroticism > 70) {
        personalityGuidance = '\nYour personality: High extraversion/anxiety - you\'re more likely to check in when left on read.';
      } else if (extraversion < 30 && neuroticism < 30) {
        personalityGuidance = '\nYour personality: Low extraversion/anxiety - you\'re more chill about being left on read.';
      } else {
        personalityGuidance = '\nYour personality: Moderate - you might check in if something feels off.';
      }

      const decisionPrompt = `You are deciding if this character should send a follow-up message on a dating app.

Character: ${characterName}
Description: ${characterDescription}${personalityGuidance}

Situation: You sent a message ${minutesSinceRead} minutes ago. They opened the chat and read it, but haven't responded yet.

Recent conversation:
${lastMessages.map(m => `${m.role === 'user' ? 'User' : characterName}: ${m.content}`).join('\n')}

Should you follow up? Consider:
- Your personality (are you the type to double-text?)
- The conversation context (did you ask a question? was it heavy?)
- The time gap (${minutesSinceRead} min is pretty short)
- Their pattern (have they done this before?)

IMPORTANT: Don't be needy or annoying. Only follow up if it feels natural for your personality.

Output your decision in this EXACT format:

Should Send: [yes/no]
Message Type: left_on_read
Reason: [brief explanation in one sentence]

Output ONLY the three lines in the exact format shown above, nothing else.`;

      console.log('🎯 Left-On-Read Decision Engine Request:', {
        model: decisionSettings.model,
        minutesSinceRead,
        extraversion,
        neuroticism
      });

      const response = await aiService.createBasicCompletion(decisionPrompt, {
        model: decisionSettings.model,
        temperature: decisionSettings.temperature,
        max_tokens: decisionSettings.max_tokens,
        top_p: decisionSettings.top_p,
        frequency_penalty: decisionSettings.frequency_penalty,
        presence_penalty: decisionSettings.presence_penalty,
        top_k: decisionSettings.top_k,
        repetition_penalty: decisionSettings.repetition_penalty,
        min_p: decisionSettings.min_p,
        messageType: 'decision-left-on-read',
        characterName: characterName
      });

      const content = response.content.trim();

      // Parse response
      return this.parseProactiveDecisionResponse(content);
    } catch (error) {
      console.error('❌ Left-On-Read Decision Engine error:', error.message);
      // On error, don't send
      return this.getDefaultProactiveDecision();
    }
  }
}

export default new DecisionEngineService();
