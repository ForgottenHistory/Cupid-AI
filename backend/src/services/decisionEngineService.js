import llmSettingsService from './llmSettingsService.js';
import promptBuilderService from './promptBuilderService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DecisionEngineService {
  /**
   * Load character states from user config file
   * @param {number} userId - User ID
   * @returns {Array} Array of { id, name, description }
   */
  loadCharacterStates(userId) {
    try {
      // Try user-specific config first
      let statesPath = path.join(__dirname, '../../config/users', String(userId), 'characterStates.txt');
      if (!fs.existsSync(statesPath)) {
        // Fall back to default config
        statesPath = path.join(__dirname, '../../config/characterStates.txt');
      }

      if (!fs.existsSync(statesPath)) {
        return [];
      }

      const content = fs.readFileSync(statesPath, 'utf-8');
      const states = [];

      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) continue;

        const parts = trimmed.split('|').map(p => p.trim());
        if (parts.length >= 3) {
          states.push({
            id: parts[0],
            name: parts[1],
            description: parts[2]
          });
        }
      }

      return states;
    } catch (error) {
      console.error('Error loading character states:', error);
      return [];
    }
  }
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
  async makeDecision({ messages, characterData, characterId = null, userMessage, userId, isEngaged = false, hasVoice = false, hasImage = false, lastMoodMessageCount = 0, assistantMessageCount = 0, currentStatus = null, schedule = null, userBio = null, shouldGenerateCharacterMood = false }) {
    try {
      const aiService = await this.getAIService();
      // Check mood cooldown (25 messages)
      const moodCooldownMessages = 25;
      const messagesSinceLastMood = assistantMessageCount - lastMoodMessageCount;
      const canChangeMood = messagesSinceLastMood >= moodCooldownMessages;

      // Log cooldown status for debugging
      console.log(`🎨 Background mood: ${messagesSinceLastMood} messages since last change (cooldown: ${canChangeMood ? 'can change' : `${moodCooldownMessages - messagesSinceLastMood} more needed`})`)

      const decisionSettings = llmSettingsService.getDecisionSettings(userId);

      // Get thought frequency setting (0 = disabled, 1-25 = every Nth message)
      const db = (await import('../db/database.js')).default;
      const thoughtSettings = db.prepare('SELECT thought_frequency FROM users WHERE id = ?').get(userId);
      const thoughtFrequency = thoughtSettings?.thought_frequency ?? 10;

      // Check if this is a thought message (based on user setting)
      const shouldGenerateThought = thoughtFrequency > 0 && (assistantMessageCount + 1) % thoughtFrequency === 0;

      if (shouldGenerateThought) {
        console.log(`💭 Decision Engine: Thought will be requested (message ${assistantMessageCount + 1}, frequency: every ${thoughtFrequency})`);
      } else if (thoughtFrequency === 0) {
        console.log(`💭 Decision Engine: Thoughts disabled by user setting`);
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

      // Extract character name and description (minimal context for decision-making)
      const characterName = characterData.data?.name || characterData.name || 'Character';
      const characterDescription = characterData.data?.description || characterData.description || '';

      // Build minimal character context (NOT the full system prompt - decision engine doesn't need all that)
      const characterContext = `You are analyzing a conversation as ${characterName}.
Character: ${characterName}
${characterDescription ? `Description: ${characterDescription}` : ''}
${currentStatus ? `Current Status: ${currentStatus.status}${currentStatus.activity ? ` (${currentStatus.activity})` : ''}` : ''}`;

      // Format conversation history (same format as chat prompt, includes TIME GAPs)
      const conversationHistory = messages.map(m => {
        if (m.role === 'system') {
          return m.content; // TIME GAP markers, summaries, etc.
        }
        return `${m.role === 'user' ? 'User' : characterName}: ${m.content}`;
      }).join('\n');

      // Load decision prompt from config
      const { loadPrompts } = await import('../routes/prompts.js');
      const prompts = loadPrompts(userId);

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

      // Handle character mood conditional FIRST (before thought, since thought guidelines regex could eat it)
      decisionPromptTemplate = decisionPromptTemplate.replace(
        '{shouldGenerateCharacterMood}',
        shouldGenerateCharacterMood ? '' : '##REMOVE_CHARACTER_MOOD##'
      );

      if (!shouldGenerateCharacterMood) {
        decisionPromptTemplate = decisionPromptTemplate.replace(/\{characterMoodGuidelines\}[^\{]*/g, '');
      } else {
        decisionPromptTemplate = decisionPromptTemplate.replace('{characterMoodGuidelines}', '\n');
      }

      if (!shouldGenerateThought) {
        decisionPromptTemplate = decisionPromptTemplate.replace(/\{thoughtGuidelines\}[^\{]*/g, '');
      } else {
        decisionPromptTemplate = decisionPromptTemplate.replace('{thoughtGuidelines}', '\n');
      }

      // Handle character state conditional (same trigger as characterMood - every 25 messages or TIME GAP)
      const shouldGenerateCharacterState = shouldGenerateCharacterMood;
      decisionPromptTemplate = decisionPromptTemplate.replace(
        '{shouldGenerateCharacterState}',
        shouldGenerateCharacterState ? '' : '##REMOVE_CHARACTER_STATE##'
      );

      if (!shouldGenerateCharacterState) {
        decisionPromptTemplate = decisionPromptTemplate.replace(/\{characterStateGuidelines\}[^\{]*/g, '');
        decisionPromptTemplate = decisionPromptTemplate.replace('{availableStates}', '');
      } else {
        decisionPromptTemplate = decisionPromptTemplate.replace('{characterStateGuidelines}', '\n');
        // Load and format available states
        const characterStates = this.loadCharacterStates(userId);
        const statesFormatted = characterStates.map(s => `    - "${s.id}" = ${s.name}: ${s.description}`).join('\n');
        decisionPromptTemplate = decisionPromptTemplate.replace('{availableStates}', statesFormatted || '    (no states configured)');
      }

      // Remove marker lines
      decisionPromptTemplate = decisionPromptTemplate.replace(/##REMOVE_VOICE##[^\n]*\n?/g, '');
      decisionPromptTemplate = decisionPromptTemplate.replace(/##REMOVE_IMAGE##[^\n]*\n?/g, '');
      decisionPromptTemplate = decisionPromptTemplate.replace(/##REMOVE_THOUGHT##[^\n]*\n?/g, '');
      decisionPromptTemplate = decisionPromptTemplate.replace(/##REMOVE_CHARACTER_MOOD##[^\n]*\n?/g, '');
      decisionPromptTemplate = decisionPromptTemplate.replace(/##REMOVE_CHARACTER_STATE##[^\n]*\n?/g, '');

      // Get character-specific post instructions (same as Content LLM)
      const postInstructions = promptBuilderService.getPostInstructions(characterId);
      const postInstructionsSection = postInstructions ? `\n\nCharacter-specific instructions:\n${postInstructions}` : '';

      const decisionPrompt = `${characterContext}
${personalityContext}
${isEngaged ? '\nEngagement: Actively engaged in conversation' : '\nEngagement: Disengaged (slower responses)'}
${hasVoice ? '\nVoice: Available' : ''}
${hasImage ? '\nImage generation: Available' : ''}

Conversation history:
${conversationHistory}

User just sent: "${userMessage}"
${postInstructionsSection}

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
        console.log(`🚫 Mood change BLOCKED by cooldown (LLM wanted: ${decision.mood}, ${moodCooldownMessages - messagesSinceLastMood} more messages needed)`);
        decision.mood = 'none';
      } else if (decision.mood !== 'none') {
        console.log(`✅ Mood change ALLOWED: ${decision.mood} (25+ messages since last change)`);
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
      const metadataSettings = llmSettingsService.getMetadataSettings(userId);

      // Extract character name
      const characterName = characterData.data?.name || characterData.name || 'Character';

      // Build system prompt (same as chat) - include characterId for memories
      const systemPrompt = promptBuilderService.buildSystemPrompt(characterData, characterId, currentStatus, userBio, schedule, false, false, null, null, null, null, 'User', userId);

      // Format conversation history (same format as chat prompt, includes TIME GAPs)
      const conversationHistory = messages.map(m => {
        if (m.role === 'system') {
          return m.content; // TIME GAP markers, summaries, etc.
        }
        return `${m.role === 'user' ? 'User' : characterName}: ${m.content}`;
      }).join('\n');

      // Load prompts from config
      const { loadPrompts } = await import('../routes/prompts.js');
      const prompts = loadPrompts(userId);

      // Get random opener variety and inject it into the fresh prompt
      const openerVariety = promptBuilderService.getRandomOpenerVariety(userId);
      const freshPrompt = prompts.proactiveFreshPrompt.replace('{openerVariety}', openerVariety || 'Start with something interesting and engaging');

      const decisionPrompt = `${systemPrompt}

Time since last message: ${gapHours.toFixed(1)} hours

Conversation history:
${conversationHistory}

${freshPrompt}

${prompts.proactiveDecisionPrompt}`;

      console.log('🎯 Proactive Decision Engine Request:', {
        model: metadataSettings.model,
        gapHours: gapHours.toFixed(1)
      });

      const response = await aiService.createBasicCompletion(decisionPrompt, {
        userId: userId,
        provider: metadataSettings.provider,
        model: metadataSettings.model,
        temperature: metadataSettings.temperature,
        max_tokens: metadataSettings.max_tokens,
        top_p: metadataSettings.top_p,
        frequency_penalty: metadataSettings.frequency_penalty,
        presence_penalty: metadataSettings.presence_penalty,
        top_k: metadataSettings.top_k,
        repetition_penalty: metadataSettings.repetition_penalty,
        min_p: metadataSettings.min_p,
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
        characterMood: null,
        characterState: null,
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
        } else if (line.startsWith('Character Mood:')) {
          const value = line.substring('Character Mood:'.length).trim();
          if (value) {
            // Remove quotes if present
            decision.characterMood = value.replace(/^["']|["']$/g, '');
          }
        } else if (line.startsWith('Character State:')) {
          const value = line.substring('Character State:'.length).trim().toLowerCase();
          // If it's "none" or empty, keep null. Otherwise use the state id
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
      characterMood: null,
      characterState: null,
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
      const metadataSettings = llmSettingsService.getMetadataSettings(userId);

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
        model: metadataSettings.model,
        minutesSinceRead,
        extraversion,
        neuroticism
      });

      const response = await aiService.createBasicCompletion(decisionPrompt, {
        userId: userId,
        provider: metadataSettings.provider,
        model: metadataSettings.model,
        temperature: metadataSettings.temperature,
        max_tokens: metadataSettings.max_tokens,
        top_p: metadataSettings.top_p,
        frequency_penalty: metadataSettings.frequency_penalty,
        presence_penalty: metadataSettings.presence_penalty,
        top_k: metadataSettings.top_k,
        repetition_penalty: metadataSettings.repetition_penalty,
        min_p: metadataSettings.min_p,
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
