import axios from 'axios';
import llmSettingsService from './llmSettingsService.js';
import tokenService from './tokenService.js';
import promptBuilderService from './promptBuilderService.js';
import decisionEngineService from './decisionEngineService.js';
import personalityService from './personalityService.js';

class AIService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

    if (!this.apiKey) {
      console.warn('⚠️  OPENROUTER_API_KEY not found in environment variables');
    }
  }

  /**
   * Send a chat completion request to OpenRouter
   */
  async createChatCompletion({ messages, characterData, model = null, userId = null, maxTokens = null, currentStatus = null, userBio = null, schedule = null, isDeparting = false, isProactive = false, proactiveType = null, decision = null }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const systemPrompt = promptBuilderService.buildSystemPrompt(characterData, currentStatus, userBio, schedule, isDeparting, isProactive, proactiveType, decision);
      const userSettings = llmSettingsService.getUserSettings(userId);
      const selectedModel = model || userSettings.model;
      const effectiveMaxTokens = maxTokens || userSettings.max_tokens;

      // Trim messages to fit within context window
      const trimmedMessages = tokenService.trimMessagesToContextWindow(
        messages,
        systemPrompt,
        userSettings.context_window,
        effectiveMaxTokens
      );

      console.log('🤖 OpenRouter Request:', {
        model: selectedModel,
        temperature: userSettings.temperature,
        max_tokens: effectiveMaxTokens,
        context_window: userSettings.context_window,
        messageCount: trimmedMessages.length + 1, // +1 for system prompt
        originalMessageCount: messages.length
      });

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: selectedModel,
          messages: [
            { role: 'system', content: systemPrompt },
            ...trimmedMessages
          ],
          temperature: userSettings.temperature,
          max_tokens: effectiveMaxTokens,
          top_p: userSettings.top_p,
          frequency_penalty: userSettings.frequency_penalty,
          presence_penalty: userSettings.presence_penalty,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://localhost:3000',
            'X-Title': 'AI-Dater',
          }
        }
      );

      const rawContent = response.data.choices[0].message.content;

      // Parse image tags if present
      let content = rawContent;
      let imageTags = null;

      const imageTagsMatch = rawContent.match(/^\[IMAGE_TAGS:\s*([^\]]+)\]/i);
      if (imageTagsMatch) {
        imageTags = imageTagsMatch[1].trim();
        // Remove the tags from the content
        content = rawContent.substring(imageTagsMatch[0].length).trim();
      }

      console.log('✅ OpenRouter Response:', {
        model: response.data.model,
        contentLength: content?.length || 0,
        imageTags: imageTags || 'none',
        usage: response.data.usage
      });

      return {
        content: content,
        imageTags: imageTags,
        model: response.data.model,
        usage: response.data.usage,
      };
    } catch (error) {
      console.error('❌ OpenRouter API error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        model: model || llmSettingsService.getDefaultContentSettings().model
      });
      throw new Error(error.response?.data?.error?.message || error.message || 'AI service error');
    }
  }

  /**
   * Decision Engine: Analyze conversation and decide on actions
   * Delegates to decisionEngineService
   */
  async makeDecision(params) {
    return decisionEngineService.makeDecision(params);
  }

  /**
   * Proactive Decision Engine: Decide if character should send proactive message
   * Delegates to decisionEngineService
   */
  async makeProactiveDecision(params) {
    return decisionEngineService.makeProactiveDecision(params);
  }

  /**
   * Generate Big Five personality traits for a character
   * Delegates to personalityService
   */
  async generatePersonality(characterData) {
    return personalityService.generatePersonality(characterData);
  }

  /**
   * Stream chat completion (for future implementation)
   */
  async createChatCompletionStream({ messages, characterData, model = null, currentStatus = null, userBio = null, schedule = null }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const systemPrompt = promptBuilderService.buildSystemPrompt(characterData, currentStatus, userBio, schedule);
    const userSettings = llmSettingsService.getUserSettings(null);

    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: model || userSettings.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.8,
        max_tokens: 800,
        stream: true,
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://localhost:3000',
          'X-Title': 'AI-Dater',
        },
        responseType: 'stream',
      }
    );

    return response.data;
  }
}

export default new AIService();
