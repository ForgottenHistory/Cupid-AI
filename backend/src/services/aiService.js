import axios from 'axios';
import db from '../db/database.js';
import llmSettingsService from './llmSettingsService.js';
import tokenService from './tokenService.js';
import promptBuilderService from './promptBuilderService.js';
import decisionEngineService from './decisionEngineService.js';
import personalityService from './personalityService.js';
import queueService from './queueService.js';
import timeGapService from './timeGapService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AIService {
  constructor() {
    this.openrouterApiKey = process.env.OPENROUTER_API_KEY;
    this.featherlessApiKey = process.env.FEATHERLESS_API_KEY;
    this.nanogptApiKey = process.env.NANOGPT_API_KEY;
    this.openrouterBaseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.featherlessBaseUrl = 'https://api.featherless.ai/v1';
    this.nanogptBaseUrl = 'https://nano-gpt.com/api/v1';

    if (!this.openrouterApiKey) {
      console.warn('⚠️  OPENROUTER_API_KEY not found in environment variables');
    }
    if (!this.featherlessApiKey) {
      console.warn('⚠️  FEATHERLESS_API_KEY not found in environment variables');
    }
    if (!this.nanogptApiKey) {
      console.warn('⚠️  NANOGPT_API_KEY not found in environment variables');
    }
  }

  /**
   * Strip unwanted formatting from AI response content and validate it's not empty
   * @param {string} content - The response content to process
   * @param {string} rawContent - Original raw content for error context
   * @returns {string} Processed content
   * @throws {Error} If content is empty or invalid after processing
   */
  stripAndValidateContent(content, rawContent) {
    // Strip any <think></think> tags (reasoning/thinking output from some models)
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    content = content.replace(/<\/?think>/gi, '').trim();

    // Strip everything before and including </think> (for models that leak reasoning without opening tag)
    // This handles cases like: "<|tool_call_begin|>reasoning...</think>actual response"
    const thinkEndIndex = content.lastIndexOf('</think>');
    if (thinkEndIndex !== -1) {
      content = content.substring(thinkEndIndex + '</think>'.length).trim();
    }

    // Strip RP actions wrapped in asterisks (e.g. *leans back*, *sighs*)
    // The system prompt forbids roleplay formatting, so remove it
    content = content.replace(/\*[^*]+\*/g, '').trim();

    // Check if content is empty after stripping
    if (!content && rawContent) {
      console.warn('⚠️ Response is empty after stripping formatting');
      throw new Error('Response was empty after stripping formatting.');
    }

    // Check if content is just a character name followed by colon with nothing after
    // e.g. "Character Name:" or "Character Name (Game): " (empty response)
    if (/^[^:]+:\s*$/.test(content)) {
      console.warn('⚠️ Response is just character name with colon, no actual content:', content);
      throw new Error('Response was empty - model returned only character name prefix without content.');
    }

    return content;
  }

  /**
   * Estimate token count for a messages array
   * Uses rough estimation: 1 token ≈ 4 characters (75% accuracy)
   * @param {Array} messages - Array of message objects with content
   * @returns {number} Estimated token count
   */
  estimateTokenCount(messages) {
    if (!messages || messages.length === 0) {
      return 0;
    }

    let totalChars = 0;

    for (const msg of messages) {
      if (msg.content) {
        totalChars += msg.content.length;
      }
      // Add overhead for role and structure (~10 chars per message)
      totalChars += 10;
    }

    // 1 token ≈ 4 characters
    return Math.ceil(totalChars / 4);
  }

  /**
   * Get provider configuration (API key and base URL) for a given provider
   * @param {string} provider - 'openrouter', 'featherless', or 'nanogpt'
   * @returns {object} { apiKey, baseUrl, name }
   */
  getProviderConfig(provider) {
    const normalized = provider?.toLowerCase() || 'openrouter';

    switch (normalized) {
      case 'featherless':
        return {
          apiKey: this.featherlessApiKey,
          baseUrl: this.featherlessBaseUrl,
          name: 'Featherless'
        };
      case 'nanogpt':
        return {
          apiKey: this.nanogptApiKey,
          baseUrl: this.nanogptBaseUrl,
          name: 'NanoGPT'
        };
      case 'openrouter':
      default:
        return {
          apiKey: this.openrouterApiKey,
          baseUrl: this.openrouterBaseUrl,
          name: 'OpenRouter'
        };
    }
  }

  /**
   * Send a chat completion request to AI provider (OpenRouter or Featherless)
   */
  async createChatCompletion({ messages, characterData, characterId = null, model = null, userId = null, userName = null, maxTokens = null, currentStatus = null, userBio = null, schedule = null, isDeparting = false, isProactive = false, proactiveType = null, decision = null, gapHours = null, isFirstMessage = false, matchedDate = null, characterMood = null, characterState = null }) {
    try {
      const systemPrompt = promptBuilderService.buildSystemPrompt(characterData, characterId, currentStatus, userBio, schedule, isDeparting, isProactive, proactiveType, decision, gapHours, matchedDate, userName, userId);

      // Use Metadata LLM for proactive-fresh messages, Content LLM for everything else
      const useMetadataLlm = isProactive && proactiveType === 'fresh';
      const userSettings = useMetadataLlm
        ? llmSettingsService.getMetadataSettings(userId)
        : llmSettingsService.getUserSettings(userId);

      // Get includeFullSchedule setting from database
      const behaviorSettings = db.prepare('SELECT include_full_schedule FROM users WHERE id = ?').get(userId);
      const includeFullSchedule = behaviorSettings?.include_full_schedule === 1;
      const selectedModel = model || userSettings.model;
      const effectiveMaxTokens = maxTokens || userSettings.max_tokens;
      const provider = userSettings.provider || 'openrouter';

      // Get provider configuration
      const providerConfig = this.getProviderConfig(provider);

      if (!providerConfig.apiKey) {
        throw new Error(`${providerConfig.name} API key not configured`);
      }

      // Trim messages to fit within context window
      const trimmedMessages = tokenService.trimMessagesToContextWindow(
        messages,
        systemPrompt,
        userSettings.context_window,
        effectiveMaxTokens
      );

      console.log(`🤖 ${providerConfig.name} Request:`, {
        provider: provider,
        model: selectedModel,
        temperature: userSettings.temperature,
        max_tokens: effectiveMaxTokens,
        context_window: userSettings.context_window,
        messageCount: trimmedMessages.length + 1, // +1 for system prompt
        originalMessageCount: messages.length,
        llmType: useMetadataLlm ? 'metadata' : 'content'
      });

      // Split message history: keep last 5 separate for recency
      // BUT if the message right before the last 5 is a TIME GAP, include it with last 5
      let splitIndex = trimmedMessages.length - 5;

      // Walk backwards from splitIndex to include any TIME GAP messages
      // Note: At this point messages are already formatted by getConversationHistory()
      // TIME GAP markers will have role='system' and content starting with '[TIME GAP:'
      while (splitIndex > 0 &&
             trimmedMessages[splitIndex - 1].role === 'system' &&
             trimmedMessages[splitIndex - 1].content.startsWith('[TIME GAP:')) {
        splitIndex--;
      }

      const last5Messages = trimmedMessages.slice(splitIndex);
      const olderMessages = trimmedMessages.slice(0, splitIndex);

      // Build final messages array with older history first
      const finalMessages = [
        { role: 'system', content: systemPrompt }
      ];

      // Include full schedule right after system prompt if enabled
      if (includeFullSchedule && schedule) {
        const fullSchedule = promptBuilderService.buildFullSchedule(schedule);
        if (fullSchedule) {
          finalMessages.push({ role: 'system', content: fullSchedule });
        }
      }

      // Add older conversation history
      finalMessages.push(...olderMessages);

      // Append current date/time reminder
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

      // For proactive messages, append instructions
      if (isProactive && proactiveType) {
        const proactiveInstructions = promptBuilderService.buildProactiveInstructions(proactiveType, gapHours, isFirstMessage, userId);
        finalMessages.push({ role: 'system', content: proactiveInstructions });
      }

      // Append current status and schedule activities
      const contextParts = [];

      if (currentStatus) {
        const currentStatusMessage = promptBuilderService.buildCurrentStatus(currentStatus, characterMood, characterState, userId);
        if (currentStatusMessage) {
          contextParts.push(currentStatusMessage);
        }
      }

      if (schedule) {
        const scheduleActivities = promptBuilderService.buildScheduleActivities(schedule);
        if (scheduleActivities) {
          contextParts.push(scheduleActivities);
        }
      }

      if (contextParts.length > 0) {
        finalMessages.push({ role: 'system', content: contextParts.join('\n\n') });
      }

      // Add roleplay reminder to keep AI on track
      // Check if there's a time gap in the last 5 messages
      const hasTimeGap = last5Messages.some(msg =>
        msg.role === 'system' && msg.content.startsWith('[TIME GAP:')
      );

      let roleplayReminder = '⚠️ CRITICAL - RESUME ROLEPLAY NOW: Write something ENTIRELY NEW that progresses the conversation forward. DO NOT copy, repeat, or paraphrase any previous messages. DO NOT regenerate old content. Stay in character. Write as the character would naturally text in this dating app conversation - no narration, no actions in asterisks, just authentic new messages.';

      if (hasTimeGap) {
        roleplayReminder += '\n\n⏰ TIME GAP DETECTED: There was a significant time gap in this conversation. Respond naturally as if time has actually passed. DON\'T immediately continue the old topic - acknowledge the gap, ask what\'s up, or bring up something new. The conversation context may have changed.';
      }

      finalMessages.push({
        role: 'system',
        content: roleplayReminder
      });

      // Add last 5 messages for maximum recency (right before character prime)
      // TIME GAP messages are already included if they immediately precede the last 5
      finalMessages.push(...last5Messages);

      // Add character-specific post instructions right before character name primer
      const postInstructions = promptBuilderService.getPostInstructions(characterId);
      if (postInstructions) {
        finalMessages.push({
          role: 'system',
          content: postInstructions
        });
      }

      // Add character name prompt at the very end to prime the response
      // If sending image/voice, add tags on first line, then character name on second line
      const characterName = characterData.data?.name || characterData.name || 'Character';
      let primeContent = `${characterName}: `;

      if (decision) {
        if (decision.shouldSendImage && decision.imageTags) {
          primeContent = `${characterName}: [IMAGE: ${decision.imageTags}]\n[Now write a short caption to go with this pic.]\n${characterName}: `;
        } else if (decision.shouldSendVoice) {
          primeContent = `${characterName}: [VOICE]\n${characterName}: `;
        }
      }

      finalMessages.push({ role: 'assistant', content: primeContent, prefix: true });

      // Log prompt for debugging (keep last 5) - log the ACTUAL messages being sent
      const logUserName = userName || 'User';
      const messageType = isProactive ? `proactive-${proactiveType}${isFirstMessage ? '-first' : ''}` : 'chat';
      const logId = this.savePromptLog(finalMessages, messageType, characterName, logUserName);

      // Build request body with provider-specific penalty parameters
      // OpenRouter: Use frequency_penalty/presence_penalty (OpenAI-style, widely supported)
      // Featherless: Use repetition_penalty/top_k/min_p (vLLM-native, avoids conflicts)
      // NanoGPT: Supports all parameters (provider-agnostic routing)
      const requestBody = {
        model: selectedModel,
        messages: finalMessages,
        temperature: userSettings.temperature,
        max_tokens: effectiveMaxTokens,
        top_p: userSettings.top_p,
      };

      if (provider === 'featherless') {
        // Featherless (vLLM): Use vLLM-native parameters
        const repPenalty = userSettings.repetition_penalty ?? 1.0;
        const topK = userSettings.top_k ?? -1;
        const minP = userSettings.min_p ?? 0.0;

        if (repPenalty !== 1.0) {
          requestBody.repetition_penalty = repPenalty;
        }
        if (topK !== -1) {
          requestBody.top_k = topK;
        }
        if (minP !== 0.0) {
          requestBody.min_p = minP;
        }
      } else if (provider === 'nanogpt') {
        // NanoGPT: Supports all extended sampling parameters
        requestBody.frequency_penalty = userSettings.frequency_penalty ?? 0.0;
        requestBody.presence_penalty = userSettings.presence_penalty ?? 0.0;

        const repPenalty = userSettings.repetition_penalty ?? 1.0;
        const topK = userSettings.top_k ?? -1;
        const minP = userSettings.min_p ?? 0.0;

        if (repPenalty !== 1.0) {
          requestBody.repetition_penalty = repPenalty;
        }
        if (topK !== -1) {
          requestBody.top_k = topK;
        }
        if (minP !== 0.0) {
          requestBody.min_p = minP;
        }

        // NanoGPT reasoning support for thinking models
        if (userSettings.reasoning_effort) {
          requestBody.reasoning_effort = userSettings.reasoning_effort;
          // Exclude reasoning from response to prevent leaking into content
          requestBody.reasoning = { exclude: true };
        }
      } else {
        // OpenRouter: Use OpenAI-style parameters (widely supported across providers)
        requestBody.frequency_penalty = userSettings.frequency_penalty ?? 0.0;
        requestBody.presence_penalty = userSettings.presence_penalty ?? 0.0;
      }

      // Execute request with retry logic
      const maxRetries = 3;
      let lastError = null;
      let response = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Execute request through queue to respect concurrency limits
          response = await queueService.enqueue(provider, async () => {
            return await axios.post(
              `${providerConfig.baseUrl}/chat/completions`,
              requestBody,
              {
                headers: {
                  'Authorization': `Bearer ${providerConfig.apiKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': 'https://localhost:3000',
                  'X-Title': 'Cupid-AI',
                },
                timeout: (userSettings.request_timeout || 120) * 1000
              }
            );
          });

          // Success! Break out of retry loop
          if (attempt > 0) {
            console.log(`✅ ${providerConfig.name} chat request succeeded after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}`);
          }
          break;
        } catch (error) {
          lastError = error;
          const status = error.response?.status;

          // Check if error is retryable
          if (attempt < maxRetries && this.isRetryableError(error)) {
            // Calculate exponential backoff: 1s, 2s, 4s
            const delayMs = Math.pow(2, attempt) * 1000;
            console.warn(`⚠️  ${providerConfig.name} chat request failed (${status || error.code}), retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
            await this.sleep(delayMs);
            continue; // Retry
          }

          // Non-retryable error or max retries exceeded
          console.error(`❌ ${providerConfig.name} API error (after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}):`, {
            provider: provider,
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            model: model || userSettings.model
          });
          throw new Error(error.response?.data?.error?.message || error.message || `${providerConfig.name} service error`);
        }
      }

      // If we exhausted retries without success
      if (!response) {
        throw new Error(lastError.response?.data?.error?.message || lastError.message || `${providerConfig.name} service error after ${maxRetries} retries`);
      }

      const message = response.data.choices[0].message;
      const rawContent = message.content; // Save raw content before processing
      let content = message.content;

      // Extract reasoning if present (separate field for some models like DeepSeek)
      const reasoning = message.reasoning || null;

      // Check for incomplete <think> tags (opening without closing)
      // This happens when the response is truncated due to output length limits
      const openThinkTags = (content.match(/<think>/gi) || []).length;
      const closeThinkTags = (content.match(/<\/think>/gi) || []).length;
      if (openThinkTags > closeThinkTags) {
        console.error('❌ Incomplete <think> tag detected - response truncated');
        throw new Error('Response contains incomplete <think> tag - response was truncated. Please retry or increase max_tokens.');
      }

      // Strip formatting and validate content
      content = this.stripAndValidateContent(content, rawContent);

      // Log reasoning for debugging if present
      if (reasoning) {
        console.log('🧠 REASONING DETECTED:', reasoning);
      }

      // Strip any leading "Name: " pattern (AI priming artifact)
      // Example: "Jane Doe: message" -> "message"
      // Only matches names (letters, spaces, hyphens, apostrophes), NOT brackets or special chars
      content = content.replace(/^[A-Za-z\s'-]+:\s*/, '');

      // Strip "\nName: ..." pattern and everything after (model incorrectly continued with another primed line)
      // Example: "valid message\nJane: invalid continuation" -> "valid message"
      content = content.replace(/\n[A-Za-z\s'-]+:\s*[\s\S]*$/, '').trim();

      // Strip any text in square brackets [...]
      // Remove entire lines that contain only bracketed text, or inline brackets
      content = content.replace(/^\[.*?\]\s*$/gm, '').replace(/\[.*?\]/g, '').trim();

      console.log(`✅ ${providerConfig.name} Response:`, {
        provider: provider,
        model: response.data.model,
        contentLength: content?.length || 0,
        usage: response.data.usage,
        hasReasoning: !!reasoning
      });

      // Log response for debugging (matching ID to prompt) - include both raw and processed
      this.saveResponseLog(content, rawContent, messageType, logId, response.data);

      return {
        content: content,
        model: response.data.model,
        usage: response.data.usage,
        reasoning: reasoning, // Include reasoning if available
      };
    } catch (error) {
      const userSettings = llmSettingsService.getUserSettings(userId);
      const provider = userSettings.provider || 'openrouter';
      const providerConfig = this.getProviderConfig(provider);

      console.error(`❌ ${providerConfig.name} API error:`, {
        provider: provider,
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        model: model || userSettings.model
      });
      throw new Error(error.response?.data?.error?.message || error.message || `${providerConfig.name} service error`);
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
   * Helper to check if an error is retryable
   */
  isRetryableError(error) {
    const status = error.response?.status;
    // Retry on: 429 (rate limit), 500, 502, 503, 504 (server errors)
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
  }

  /**
   * Helper to wait/sleep for a duration
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Basic completion for simple tasks (post generation, etc.)
   * No character context, just a simple prompt → response
   * Includes retry logic with exponential backoff for reliability
   */
  async createBasicCompletion(prompt, options = {}) {
    // Use user's LLM settings based on llmType (defaults to 'content')
    // llmType can be: 'content', 'decision', 'imagetag', or 'metadata'
    const llmType = options.llmType || 'content';

    let userSettings;
    if (options.userId) {
      if (llmType === 'metadata') {
        userSettings = llmSettingsService.getMetadataSettings(options.userId);
      } else if (llmType === 'decision') {
        userSettings = llmSettingsService.getDecisionSettings(options.userId);
      } else if (llmType === 'imagetag') {
        userSettings = llmSettingsService.getImageTagSettings(options.userId);
      } else {
        userSettings = llmSettingsService.getUserSettings(options.userId);
      }
    } else {
      // No userId provided - use defaults
      if (llmType === 'metadata') {
        userSettings = llmSettingsService.getDefaultMetadataSettings();
      } else if (llmType === 'decision') {
        userSettings = llmSettingsService.getDefaultDecisionSettings();
      } else if (llmType === 'imagetag') {
        userSettings = llmSettingsService.getDefaultImageTagSettings();
      } else {
        userSettings = llmSettingsService.getDefaultContentSettings();
      }
    }

    const model = options.model || userSettings.model;
    const temperature = options.temperature ?? userSettings.temperature;
    const max_tokens = options.max_tokens ?? userSettings.max_tokens;
    const provider = options.provider || userSettings.provider || 'openrouter';

    // Get provider configuration
    const providerConfig = this.getProviderConfig(provider);

    if (!providerConfig.apiKey) {
      throw new Error(`${providerConfig.name} API key not configured`);
    }

    const requestBody = {
      model: model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: temperature,
      max_tokens: max_tokens,
      top_p: options.top_p ?? 1.0,
      frequency_penalty: options.frequency_penalty ?? 0.0,
      presence_penalty: options.presence_penalty ?? 0.0,
    };

    // Add extended sampling parameters for supported providers
    // OpenRouter supports these for many models (will be ignored if unsupported)
    // Featherless always supports these parameters
    // NanoGPT supports all parameters (provider-agnostic routing)
    if (provider === 'featherless' || provider === 'openrouter' || provider === 'nanogpt') {
      // Only include if set to non-default values to avoid unnecessary params
      const repPenalty = options.repetition_penalty ?? 1.0;
      const topK = options.top_k ?? -1;
      const minP = options.min_p ?? 0.0;

      if (repPenalty !== 1.0) {
        requestBody.repetition_penalty = repPenalty;
      }
      if (topK !== -1) {
        requestBody.top_k = topK;
      }
      if (minP !== 0.0) {
        requestBody.min_p = minP;
      }
    }

    // Add reasoning support for reasoning models
    if (options.reasoning_effort) {
      if (provider === 'nanogpt') {
        // NanoGPT: top-level reasoning_effort + exclude reasoning from response
        requestBody.reasoning_effort = options.reasoning_effort;
        requestBody.reasoning = { exclude: true };
      } else if (provider === 'openrouter') {
        // OpenRouter: nested reasoning object with effort
        requestBody.reasoning = {
          effort: options.reasoning_effort
        };
      }
    }

    // Log prompt if messageType provided (keep last 5 per type)
    let logId = null;
    if (options.messageType) {
      logId = this.savePromptLog(
        requestBody.messages,
        options.messageType,
        options.characterName || 'Character',
        options.userName || 'User'
      );
    }

    // Retry configuration
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Execute request through queue to respect concurrency limits
        const response = await queueService.enqueue(provider, async () => {
          return await axios.post(
            `${providerConfig.baseUrl}/chat/completions`,
            requestBody,
            {
              headers: {
                'Authorization': `Bearer ${providerConfig.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://localhost:3000',
                'X-Title': 'Cupid-AI',
              },
              timeout: options.timeout || (userSettings.request_timeout || 120) * 1000
            }
          );
        });

        const message = response.data.choices[0].message;
        const rawContent = message.content; // Save raw content before processing
        let content = message.content;

        // Debug: Log the entire message object if content is empty but tokens were used
        if ((!content || content.trim() === '') && response.data.usage?.completion_tokens > 0) {
          console.warn('⚠️ Empty content but completion_tokens > 0. Full message object:');
          console.warn(JSON.stringify(message, null, 2));
        }

        // Strip formatting and validate content
        content = this.stripAndValidateContent(content, rawContent);

        // Log raw response for debugging reasoning mode
        if (options.reasoning_effort) {
          console.log('🧠 RAW MESSAGE:', JSON.stringify(message, null, 2));
          if (message.reasoning) {
            console.log('🧠 REASONING:', message.reasoning);
          }
        }

        // Log response for debugging (matching ID to prompt) - include both raw and processed
        if (logId && options.messageType) {
          this.saveResponseLog(content, rawContent, options.messageType, logId, response.data);
        }

        // Success! Return result
        if (attempt > 0) {
          console.log(`✅ ${providerConfig.name} request succeeded after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}`);
        }

        return {
          content: content,
          model: response.data.model,
          usage: response.data.usage,
          reasoning: message.reasoning || null, // Include reasoning if available
        };
      } catch (error) {
        lastError = error;
        const status = error.response?.status;

        // Check if error is retryable
        if (attempt < maxRetries && this.isRetryableError(error)) {
          // Calculate exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt) * 1000;
          console.warn(`⚠️  ${providerConfig.name} request failed (${status || error.code}), retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
          await this.sleep(delayMs);
          continue; // Retry
        }

        // Non-retryable error or max retries exceeded
        break;
      }
    }

    // All retries failed
    console.error(`❌ ${providerConfig.name} basic completion error (after ${maxRetries} retries):`, {
      provider: provider,
      message: lastError.message,
      status: lastError.response?.status,
      data: lastError.response?.data
    });
    throw new Error(lastError.response?.data?.error?.message || lastError.message || `${providerConfig.name} service error`);
  }

  /**
   * Save prompt to log file for debugging (keep last 5)
   * Logs the ACTUAL messages array being sent to the API
   * Returns the log ID (timestamp) for matching response logs
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
        } else if (msg.prefix) {
          // Log the actual priming content (e.g., "Nicole: ")
          parts.push('');
          parts.push(msg.content);
        } else {
          const name = msg.role === 'user' ? userName : characterName;
          parts.push(`${name}: ${msg.content}`);
        }
      });

      let logContent = parts.join('\n');

      // Clean up special markers - remove the [SYSTEM MESSAGE N]: label so they appear inline
      logContent = logContent.replace(/\[SYSTEM MESSAGE \d*\]:\n(\[TIME GAP:)/g, '\n$1');
      logContent = logContent.replace(/\[SYSTEM MESSAGE \d*\]:\n(\[.+ switched background to)/g, '\n$1');

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
      return timestamp; // Return timestamp for matching response log
    } catch (error) {
      console.error('Failed to save prompt log:', error.message);
      return null;
    }
  }

  /**
   * Save response to log file for debugging (keep last 5)
   * Uses matching timestamp from prompt log for easy correlation
   */
  saveResponseLog(processedContent, rawContent, messageType, logId, responseData) {
    try {
      if (!logId) {
        console.warn('⚠️  No log ID provided for response log, skipping');
        return;
      }

      const logsDir = path.join(__dirname, '../../logs/responses');

      // Create directory if it doesn't exist
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Use same timestamp as prompt for matching filenames
      const filename = `${messageType}-${logId}.txt`;
      const filepath = path.join(logsDir, filename);

      // Build log content
      const parts = [
        `RESPONSE LOG`,
        `Type: ${messageType}`,
        `Timestamp: ${new Date().toISOString()}`,
        `Model: ${responseData.model}`,
        ``,
        `--- RAW CONTENT (from API) ---`,
        rawContent || '(empty)',
        ``,
        `--- PROCESSED CONTENT (after stripping) ---`,
        processedContent || '(empty)',
        ``,
        `--- USAGE ---`,
        JSON.stringify(responseData.usage, null, 2)
      ];

      const logContent = parts.join('\n');

      // Write to file
      fs.writeFileSync(filepath, logContent, 'utf8');

      // Keep only last 5 files per type
      const files = fs.readdirSync(logsDir)
        .filter(f => f.startsWith(messageType.split('-')[0])) // Match by prefix
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
          console.log(`🗑️  Deleted old response log: ${file.name}`);
        });
      }

      console.log(`📝 Saved response log: ${filename}`);
    } catch (error) {
      console.error('Failed to save response log:', error.message);
    }
  }

  /**
   * Stream chat completion (for future implementation)
   */
  async createChatCompletionStream({ messages, characterData, model = null, userId = null, currentStatus = null, userBio = null, schedule = null }) {
    const systemPrompt = promptBuilderService.buildSystemPrompt(characterData, null, currentStatus, userBio, schedule, false, false, null, null, null, null, null, userId);
    const userSettings = llmSettingsService.getUserSettings(userId);
    const selectedModel = model || userSettings.model;
    const provider = userSettings.provider || 'openrouter';

    // Get provider configuration
    const providerConfig = this.getProviderConfig(provider);

    if (!providerConfig.apiKey) {
      throw new Error(`${providerConfig.name} API key not configured`);
    }

    const requestBody = {
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: userSettings.temperature,
      max_tokens: userSettings.max_tokens,
      stream: true,
    };

    // Retry configuration
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Execute request through queue to respect concurrency limits
        const response = await queueService.enqueue(provider, async () => {
          return await axios.post(
            `${providerConfig.baseUrl}/chat/completions`,
            requestBody,
            {
              headers: {
                'Authorization': `Bearer ${providerConfig.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://localhost:3000',
                'X-Title': 'Cupid-AI',
              },
              responseType: 'stream',
              timeout: (userSettings.request_timeout || 120) * 1000
            }
          );
        });

        // Success! Break out of retry loop
        if (attempt > 0) {
          console.log(`✅ ${providerConfig.name} stream request succeeded after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}`);
        }

        return response.data;
      } catch (error) {
        lastError = error;
        const status = error.response?.status;

        // Check if error is retryable
        if (attempt < maxRetries && this.isRetryableError(error)) {
          // Calculate exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt) * 1000;
          console.warn(`⚠️  ${providerConfig.name} stream request failed (${status || error.code}), retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
          await this.sleep(delayMs);
          continue; // Retry
        }

        // Non-retryable error or max retries exceeded
        break;
      }
    }

    // All retries failed
    console.error(`❌ ${providerConfig.name} stream error (after ${maxRetries} retries):`, {
      provider: provider,
      message: lastError.message,
      status: lastError.response?.status,
      data: lastError.response?.data
    });
    throw new Error(lastError.response?.data?.error?.message || lastError.message || `${providerConfig.name} service error`);
  }
}

export default new AIService();
