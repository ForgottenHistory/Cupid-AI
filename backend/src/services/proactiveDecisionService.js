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

  /**
   * Left-On-Read Decision Engine: Decide if character should follow up when user reads but doesn't respond
   * Returns: { shouldSend: boolean, messageType: "left_on_read", reason: string }
   */
  async makeLeftOnReadDecision({ messages, characterData, personality, minutesSinceRead, userId }) {
    try {
      const aiService = await this.getAIService();
      const metadataSettings = llmSettingsService.getMetadataSettings(userId);

      const lastMessages = messages.slice(-5);
      const characterName = characterData.data?.name || characterData.name || 'Character';
      const characterDescription = characterData.data?.description || characterData.description || 'N/A';

      const decisionPrompt = `You are deciding if this character should send a follow-up message on a dating app.

Character: ${characterName}
Description: ${characterDescription}

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
        minutesSinceRead
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
      return parseProactiveDecisionResponse(content);
    } catch (error) {
      console.error('❌ Left-On-Read Decision Engine error:', error.message);
      return getDefaultProactiveDecision();
    }
  }
}

export default new ProactiveDecisionService();
