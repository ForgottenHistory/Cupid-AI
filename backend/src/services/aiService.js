import axios from 'axios';
import db from '../db/database.js';
import { encode } from 'gpt-tokenizer';

class AIService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.defaultModel = 'deepseek/deepseek-chat-v3'; // Free tier model

    if (!this.apiKey) {
      console.warn('⚠️  OPENROUTER_API_KEY not found in environment variables');
    }
  }

  /**
   * Get user's LLM settings from database
   */
  getUserSettings(userId) {
    if (!userId) {
      return {
        model: this.defaultModel,
        temperature: 0.8,
        max_tokens: 800,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        context_window: 4000
      };
    }

    try {
      const settings = db.prepare(`
        SELECT llm_model, llm_temperature, llm_max_tokens, llm_top_p,
               llm_frequency_penalty, llm_presence_penalty, llm_context_window
        FROM users WHERE id = ?
      `).get(userId);

      if (!settings) {
        return {
          model: this.defaultModel,
          temperature: 0.8,
          max_tokens: 800,
          top_p: 1.0,
          frequency_penalty: 0.0,
          presence_penalty: 0.0,
          context_window: 4000
        };
      }

      return {
        model: settings.llm_model || this.defaultModel,
        temperature: settings.llm_temperature ?? 0.8,
        max_tokens: settings.llm_max_tokens ?? 800,
        top_p: settings.llm_top_p ?? 1.0,
        frequency_penalty: settings.llm_frequency_penalty ?? 0.0,
        presence_penalty: settings.llm_presence_penalty ?? 0.0,
        context_window: settings.llm_context_window ?? 4000
      };
    } catch (error) {
      console.error('Error fetching user LLM settings:', error);
      return {
        model: this.defaultModel,
        temperature: 0.8,
        max_tokens: 800,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        context_window: 4000
      };
    }
  }

  /**
   * Count tokens in text
   */
  countTokens(text) {
    try {
      return encode(text).length;
    } catch (error) {
      // Fallback: rough estimate (1 token ≈ 4 characters)
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Trim messages to fit within context window
   * Keeps system prompt + most recent messages that fit
   */
  trimMessagesToContextWindow(messages, systemPrompt, contextWindow, maxTokens) {
    // Reserve tokens for system prompt and response
    const systemTokens = this.countTokens(systemPrompt);
    const availableTokens = contextWindow - systemTokens - maxTokens - 100; // 100 token buffer

    if (availableTokens <= 0) {
      console.warn('⚠️  Context window too small for system prompt and response');
      return []; // Return empty if not enough space
    }

    // Count tokens from newest to oldest, keep messages that fit
    let totalTokens = 0;
    const trimmedMessages = [];

    // Go through messages in reverse (newest first)
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageText = `${message.role}: ${message.content}`;
      const messageTokens = this.countTokens(messageText);

      if (totalTokens + messageTokens <= availableTokens) {
        trimmedMessages.unshift(message); // Add to beginning to maintain order
        totalTokens += messageTokens;
      } else {
        // No more room, stop
        break;
      }
    }

    console.log(`📊 Context trimming: ${messages.length} messages → ${trimmedMessages.length} messages (${totalTokens}/${availableTokens} tokens)`);

    return trimmedMessages;
  }

  /**
   * Build system prompt from character data
   */
  buildSystemPrompt(characterData) {
    const parts = [];

    if (characterData.name) {
      parts.push(`You are ${characterData.name}.`);
    }

    if (characterData.description) {
      parts.push(`\nDescription: ${characterData.description}`);
    }

    if (characterData.scenario) {
      parts.push(`\nScenario: ${characterData.scenario}`);
    }

    if (characterData.system_prompt) {
      parts.push(`\n\n${characterData.system_prompt}`);
    }

    parts.push(`\n\nIMPORTANT: You are texting someone you're interested in on a dating app. Text like a real person, not a character in a story.

- NO asterisks for actions (*smiles*, *laughs*, etc)
- NO quotation marks around dialogue
- NO theatrical descriptions or over-the-top performances
- Keep it SHORT and casual - text message length (1-3 sentences usually)
- Be yourself, not an exaggerated version
- Talk like you would actually text someone
- Show personality through words, not actions

Stay true to your character but keep it real and chill.`);

    return parts.join('');
  }

  /**
   * Send a chat completion request to OpenRouter
   */
  async createChatCompletion({ messages, characterData, model = null, userId = null }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const systemPrompt = this.buildSystemPrompt(characterData);
      const userSettings = this.getUserSettings(userId);
      const selectedModel = model || userSettings.model;

      // Trim messages to fit within context window
      const trimmedMessages = this.trimMessagesToContextWindow(
        messages,
        systemPrompt,
        userSettings.context_window,
        userSettings.max_tokens
      );

      console.log('🤖 OpenRouter Request:', {
        model: selectedModel,
        temperature: userSettings.temperature,
        max_tokens: userSettings.max_tokens,
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
          max_tokens: userSettings.max_tokens,
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

      const content = response.data.choices[0].message.content;

      console.log('✅ OpenRouter Response:', {
        model: response.data.model,
        contentLength: content?.length || 0,
        contentPreview: content?.substring(0, 100),
        contentCharCodes: content ? [...content].map(c => c.charCodeAt(0)).slice(0, 10) : [],
        usage: response.data.usage,
        fullResponse: JSON.stringify(response.data.choices[0])
      });

      return {
        content: content,
        model: response.data.model,
        usage: response.data.usage,
      };
    } catch (error) {
      console.error('❌ OpenRouter API error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        model: model || this.defaultModel
      });
      throw new Error(error.response?.data?.error?.message || error.message || 'AI service error');
    }
  }

  /**
   * Stream chat completion (for future implementation)
   */
  async createChatCompletionStream({ messages, characterData, model = null }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const systemPrompt = this.buildSystemPrompt(characterData);

    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: model || this.defaultModel,
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
