import llmSettingsService from './llmSettingsService.js';
import promptBuilderService from './promptBuilderService.js';
import proactiveDecisionService from './proactiveDecisionService.js';
import { parseDecisionResponse, getDefaultDecision } from './decisionParsers.js';
import {
  buildDecisionPromptTemplate,
  buildCharacterContext,
  buildPersonalityContext,
  formatConversationHistory,
  assembleDecisionPrompt
} from './decisionPromptBuilder.js';

class DecisionEngineService {
  constructor() {
    this.aiService = null;
  }

  async getAIService() {
    if (!this.aiService) {
      const module = await import('./aiService.js');
      this.aiService = module.default;
    }
    return this.aiService;
  }

  /**
   * Decision Engine: Analyze conversation and decide on actions
   */
  async makeDecision({ messages, characterData, characterId = null, userMessage, userId, isEngaged = false, hasVoice = false, hasImage = false, lastMoodMessageCount = 0, assistantMessageCount = 0, currentStatus = null, schedule = null, userBio = null, shouldGenerateCharacterMood = false, currentCharacterState = null, currentCharacterMood = null }) {
    try {
      const aiService = await this.getAIService();

      // Check mood cooldown (10 messages)
      const moodCooldownMessages = 10;
      const messagesSinceLastMood = assistantMessageCount - lastMoodMessageCount;
      const canChangeMood = messagesSinceLastMood >= moodCooldownMessages;

      console.log(`🎨 Background mood: ${messagesSinceLastMood} messages since last change (cooldown: ${canChangeMood ? 'can change' : `${moodCooldownMessages - messagesSinceLastMood} more needed`})`);

      const decisionSettings = llmSettingsService.getDecisionSettings(userId);

      // Get thought frequency setting
      const db = (await import('../db/database.js')).default;
      const thoughtSettings = db.prepare('SELECT thought_frequency FROM users WHERE id = ?').get(userId);
      const thoughtFrequency = thoughtSettings?.thought_frequency ?? 10;
      const shouldGenerateThought = thoughtFrequency > 0 && (assistantMessageCount + 1) % thoughtFrequency === 0;

      if (shouldGenerateThought) {
        console.log(`💭 Decision Engine: Thought will be requested (message ${assistantMessageCount + 1}, frequency: every ${thoughtFrequency})`);
      } else if (thoughtFrequency === 0) {
        console.log(`💭 Decision Engine: Thoughts disabled by user setting`);
      }

      // Character state uses same trigger as characterMood
      const shouldGenerateCharacterState = shouldGenerateCharacterMood;

      // Count recent images (last 5 messages from assistant)
      const recentAssistantMessages = messages.filter(m => m.role === 'assistant').slice(-5);
      const recentImageCount = recentAssistantMessages.filter(m => m.message_type === 'image' || m.image_url).length;

      // Build context pieces
      const { characterName, characterContext } = buildCharacterContext(characterData);
      const personalityContext = buildPersonalityContext(characterData);
      const conversationHistory = formatConversationHistory(messages, characterName);

      // Build status context using the same method as chat prompt (which works)
      let statusContext = '';
      const baseStatusContext = promptBuilderService.buildCurrentStatus(currentStatus, currentCharacterMood, currentCharacterState, userId);
      if (baseStatusContext) {
        statusContext = '\n\n--- CHARACTER CONTEXT ---\n' + baseStatusContext;
      }
      // Add recent image context for image decision
      if (recentImageCount > 0) {
        statusContext += `\n📷 RECENT IMAGES: Sent ${recentImageCount} image(s) in last few messages - space them out!`;
      }

      // Load and build decision prompt template
      const { loadPrompts } = await import('../routes/prompts.js');
      const prompts = loadPrompts(userId);

      const decisionPromptTemplate = buildDecisionPromptTemplate(prompts, {
        hasVoice,
        hasImage,
        shouldGenerateThought,
        shouldGenerateCharacterMood,
        shouldGenerateCharacterState,
        canChangeMood,
        userId,
        currentCharacterState,
        currentCharacterMood
      });

      // Get character-specific post instructions
      const postInstructions = promptBuilderService.getPostInstructions(characterId);
      const postInstructionsSection = postInstructions ? `\n\nCharacter-specific instructions:\n${postInstructions}` : '';

      // Assemble full prompt
      const decisionPrompt = assembleDecisionPrompt({
        characterContext,
        personalityContext,
        isEngaged,
        hasVoice,
        hasImage,
        conversationHistory,
        userMessage,
        postInstructionsSection,
        statusContext,
        decisionPromptTemplate
      });

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
        rawContent: content
      });

      const decision = parseDecisionResponse(content);

      // Enforce mood cooldown
      if (!canChangeMood && decision.mood !== 'none') {
        console.log(`🚫 Mood change BLOCKED by cooldown (LLM wanted: ${decision.mood}, ${moodCooldownMessages - messagesSinceLastMood} more messages needed)`);
        decision.mood = 'none';
      } else if (decision.mood !== 'none') {
        console.log(`✅ Mood change ALLOWED: ${decision.mood} (10+ messages since last change)`);
      }

      return decision;
    } catch (error) {
      console.error('❌ Decision Engine error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      return getDefaultDecision();
    }
  }

  // Delegate proactive decisions to proactiveDecisionService
  async makeProactiveDecision(options) {
    return proactiveDecisionService.makeProactiveDecision(options);
  }

  async makeLeftOnReadDecision(options) {
    return proactiveDecisionService.makeLeftOnReadDecision(options);
  }
}

export default new DecisionEngineService();
