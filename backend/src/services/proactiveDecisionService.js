import llmSettingsService from './llmSettingsService.js';
import promptBuilderService from './promptBuilderService.js';
import { parseProactiveDecisionResponse, getDefaultProactiveDecision } from './decisionParsers.js';

class ProactiveDecisionService {
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
   * Proactive Decision Engine: Decide if character should send proactive message
   * Returns: { shouldSend: boolean, messageType: "fresh", reason: string }
   */
  async makeProactiveDecision({ messages, characterData, characterId = null, gapHours, userId, currentStatus = null, schedule = null, userBio = null }) {
    try {
      const aiService = await this.getAIService();
      const chatSettings = llmSettingsService.getUserSettings(userId);

      const characterName = characterData.data?.name || characterData.name || 'Character';

      // Build system prompt (same as chat) - include characterId for memories
      const systemPrompt = promptBuilderService.buildSystemPrompt(characterData, characterId, currentStatus, userBio, schedule, false, false, null, null, null, null, 'User', userId);

      // Format conversation history
      const conversationHistory = messages.map(m => {
        if (m.role === 'system') {
          return m.content;
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
        model: chatSettings.model,
        gapHours: gapHours.toFixed(1)
      });

      const response = await aiService.createBasicCompletion(decisionPrompt, {
        userId: userId,
        provider: chatSettings.provider,
        model: chatSettings.model,
        temperature: chatSettings.temperature,
        max_tokens: chatSettings.max_tokens,
        top_p: chatSettings.top_p,
        frequency_penalty: chatSettings.frequency_penalty,
        presence_penalty: chatSettings.presence_penalty,
        top_k: chatSettings.top_k,
        repetition_penalty: chatSettings.repetition_penalty,
        min_p: chatSettings.min_p,
        messageType: 'decision-proactive',
        characterName: characterName
      });

      const content = response.content.trim();
      return parseProactiveDecisionResponse(content);
    } catch (error) {
      console.error('❌ Proactive Decision Engine error:', error.message);
      return getDefaultProactiveDecision();
    }
  }

}

export default new ProactiveDecisionService();
