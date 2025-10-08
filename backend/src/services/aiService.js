import axios from 'axios';
import llmSettingsService from './llmSettingsService.js';
import tokenService from './tokenService.js';
import promptBuilderService from './promptBuilderService.js';
import decisionEngineService from './decisionEngineService.js';
import personalityService from './personalityService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  async createChatCompletion({ messages, characterData, model = null, userId = null, userName = null, maxTokens = null, currentStatus = null, userBio = null, schedule = null, isDeparting = false, isProactive = false, proactiveType = null, decision = null, gapHours = null }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const systemPrompt = promptBuilderService.buildSystemPrompt(characterData, currentStatus, userBio, schedule, isDeparting, isProactive, proactiveType, decision, gapHours);
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

      // Build final messages array
      const finalMessages = [
        { role: 'system', content: systemPrompt },
        ...trimmedMessages
      ];

      // Append current date/time reminder AFTER message history (recency bias)
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
      const timeReminder = `⏰ IMPORTANT: Current date and time is ${dayOfWeek}, ${month} ${day}, ${year} at ${displayHours}:${minutes} ${ampm}. Make sure any time/day references in your message are accurate!`;
      finalMessages.push({ role: 'system', content: timeReminder });

      // For proactive messages, append instructions AFTER message history
      if (isProactive && proactiveType) {
        const proactiveInstructions = promptBuilderService.buildProactiveInstructions(proactiveType, gapHours);
        finalMessages.push({ role: 'system', content: proactiveInstructions });
      }

      // Append decision context at the VERY END (maximum recency bias)
      if (decision) {
        const decisionParts = ['DECISION:'];

        if (decision.shouldSendImage) {
          decisionParts.push('IMAGE: YES (use [IMAGE_TAGS: ...] format)');
        } else {
          decisionParts.push('IMAGE: NO (do not mention pics)');
        }

        if (decision.shouldSendVoice) {
          decisionParts.push('VOICE: YES (write for speech)');
        } else {
          decisionParts.push('VOICE: NO');
        }

        if (decision.reaction) {
          decisionParts.push(`REACTION: ${decision.reaction}`);
        }

        if (decision.reason) {
          decisionParts.push(`REASON: ${decision.reason}`);
        }

        finalMessages.push({ role: 'system', content: decisionParts.join('\n') });
      }

      // Log prompt for debugging (keep last 5) - log the ACTUAL messages being sent
      const characterName = characterData.data?.name || characterData.name || 'Character';
      const logUserName = userName || 'User';
      const messageType = isProactive ? `proactive-${proactiveType}` : 'chat';
      this.savePromptLog(finalMessages, messageType, characterName, logUserName);

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: selectedModel,
          messages: finalMessages,
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
   * Basic completion for simple tasks (post generation, etc.)
   * No character context, just a simple prompt → response
   */
  async createBasicCompletion(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const defaultSettings = llmSettingsService.getDefaultContentSettings();
      const model = options.model || defaultSettings.model;
      const temperature = options.temperature ?? 0.8;
      const max_tokens = options.max_tokens ?? 300;

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: model,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: temperature,
          max_tokens: max_tokens,
          top_p: options.top_p ?? 1.0,
          frequency_penalty: options.frequency_penalty ?? 0.0,
          presence_penalty: options.presence_penalty ?? 0.0,
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

      return {
        content: content,
        model: response.data.model,
        usage: response.data.usage,
      };
    } catch (error) {
      console.error('❌ Basic completion error:', error.message);
      throw new Error(error.response?.data?.error?.message || error.message || 'AI service error');
    }
  }

  /**
   * Save prompt to log file for debugging (keep last 5)
   * Logs the ACTUAL messages array being sent to the API
   */
  savePromptLog(finalMessages, messageType, characterName, userName) {
    try {
      const logsDir = path.join(__dirname, '../../logs/prompts');

      // Create directory if it doesn't exist
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Generate filename with timestamp
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `${messageType}-${timestamp}.txt`;
      const filepath = path.join(logsDir, filename);

      // Build log content from finalMessages array
      const parts = [
        `PROMPT LOG`,
        `Type: ${messageType}`,
        `Timestamp: ${now.toISOString()}`,
        ''
      ];

      // Process each message in order
      finalMessages.forEach((msg, index) => {
        if (msg.role === 'system') {
          parts.push(`[SYSTEM MESSAGE ${index > 0 ? index : ''}]:`);
          parts.push(msg.content);
          parts.push('');
        } else {
          const name = msg.role === 'user' ? userName : characterName;
          parts.push(`${name}: ${msg.content}`);
        }
      });

      const logContent = parts.join('\n');

      // Write to file
      fs.writeFileSync(filepath, logContent, 'utf8');

      // Keep only last 5 files per type (chat, proactive-fresh, etc)
      const files = fs.readdirSync(logsDir)
        .filter(f => f.startsWith(messageType.split('-')[0])) // Match by prefix (chat or proactive)
        .map(f => ({
          name: f,
          path: path.join(logsDir, f),
          mtime: fs.statSync(path.join(logsDir, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Delete old files (keep only 5 newest per type)
      if (files.length > 5) {
        files.slice(5).forEach(file => {
          fs.unlinkSync(file.path);
          console.log(`🗑️  Deleted old prompt log: ${file.name}`);
        });
      }

      console.log(`📝 Saved prompt log: ${filename}`);
    } catch (error) {
      console.error('Failed to save prompt log:', error.message);
    }
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
