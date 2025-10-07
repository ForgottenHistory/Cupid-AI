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
   * Get user's Decision LLM settings from database
   */
  getDecisionLLMSettings(userId) {
    if (!userId) {
      return {
        model: this.defaultModel,
        temperature: 0.7,
        max_tokens: 500,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        context_window: 2000
      };
    }

    try {
      const settings = db.prepare(`
        SELECT decision_llm_model, decision_llm_temperature, decision_llm_max_tokens, decision_llm_top_p,
               decision_llm_frequency_penalty, decision_llm_presence_penalty, decision_llm_context_window
        FROM users WHERE id = ?
      `).get(userId);

      if (!settings) {
        return {
          model: this.defaultModel,
          temperature: 0.7,
          max_tokens: 500,
          top_p: 1.0,
          frequency_penalty: 0.0,
          presence_penalty: 0.0,
          context_window: 2000
        };
      }

      return {
        model: settings.decision_llm_model || this.defaultModel,
        temperature: settings.decision_llm_temperature ?? 0.7,
        max_tokens: settings.decision_llm_max_tokens ?? 500,
        top_p: settings.decision_llm_top_p ?? 1.0,
        frequency_penalty: settings.decision_llm_frequency_penalty ?? 0.0,
        presence_penalty: settings.decision_llm_presence_penalty ?? 0.0,
        context_window: settings.decision_llm_context_window ?? 2000
      };
    } catch (error) {
      console.error('Error fetching user Decision LLM settings:', error);
      return {
        model: this.defaultModel,
        temperature: 0.7,
        max_tokens: 500,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        context_window: 2000
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
  async createChatCompletion({ messages, characterData, model = null, userId = null, maxTokens = null }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const systemPrompt = this.buildSystemPrompt(characterData);
      const userSettings = this.getUserSettings(userId);
      const selectedModel = model || userSettings.model;
      const effectiveMaxTokens = maxTokens || userSettings.max_tokens;

      // Trim messages to fit within context window
      const trimmedMessages = this.trimMessagesToContextWindow(
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

      const content = response.data.choices[0].message.content;

      console.log('✅ OpenRouter Response:', {
        model: response.data.model,
        contentLength: content?.length || 0,
        usage: response.data.usage
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
   * Decision Engine: Analyze conversation and decide on actions
   * Returns: { reaction: string|null, shouldRespond: boolean }
   */
  async makeDecision({ messages, characterData, userMessage, userId }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const decisionSettings = this.getDecisionLLMSettings(userId);

      // Build decision prompt
      const decisionPrompt = `You are a decision-making AI that analyzes dating app conversations and decides how the character should respond.

Character: ${characterData.name}
Description: ${characterData.description || 'N/A'}

Recent conversation context:
${messages.slice(-3).map(m => `${m.role === 'user' ? 'User' : characterData.name}: ${m.content}`).join('\n')}

User just sent: "${userMessage}"

Decide on the character's behavioral response. You must output ONLY valid JSON in this exact format:
{
  "reaction": "emoji or null",
  "shouldRespond": true
}

Guidelines:
- "reaction": IMPORTANT - Reactions should be RARE (only 1 in 5 messages or less). Only react to messages that are genuinely funny, sweet, exciting, or emotionally significant. Most messages should get null. Don't react to every message!
- If you do react, choose ONE emoji that represents a strong emotional reaction (❤️, 😂, 🔥, 😍, 😭, etc.)
- "shouldRespond": Always true for now (we will expand this later)
- Consider the character's personality when choosing reactions

Output ONLY the JSON, nothing else.`;

      console.log('🎯 Decision Engine Request:', {
        model: decisionSettings.model,
        temperature: decisionSettings.temperature,
        max_tokens: decisionSettings.max_tokens
      });

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: decisionSettings.model,
          messages: [
            { role: 'user', content: decisionPrompt }
          ],
          temperature: decisionSettings.temperature,
          max_tokens: decisionSettings.max_tokens,
          top_p: decisionSettings.top_p,
          frequency_penalty: decisionSettings.frequency_penalty,
          presence_penalty: decisionSettings.presence_penalty,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://localhost:3000',
            'X-Title': 'AI-Dater Decision Engine',
          }
        }
      );

      const content = response.data.choices[0].message.content.trim();

      console.log('✅ Decision Engine Response:', {
        model: response.data.model,
        usage: response.data.usage
      });

      // Parse JSON response (strip markdown code fences if present)
      try {
        let jsonContent = content.trim();

        // Remove markdown code fences if present
        if (jsonContent.startsWith('```')) {
          jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
        }

        const decision = JSON.parse(jsonContent);
        return {
          reaction: decision.reaction || null,
          shouldRespond: decision.shouldRespond !== false // Default to true
        };
      } catch (parseError) {
        console.error('Failed to parse decision JSON:', parseError, 'Content:', content);
        // Fallback: no reaction, but respond
        return {
          reaction: null,
          shouldRespond: true
        };
      }
    } catch (error) {
      console.error('❌ Decision Engine error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      // On error, fail gracefully: no reaction, but respond
      return {
        reaction: null,
        shouldRespond: true
      };
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
