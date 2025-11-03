import axios from 'axios';
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
    this.openrouterBaseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.featherlessBaseUrl = 'https://api.featherless.ai/v1';

    if (!this.openrouterApiKey) {
      console.warn('⚠️  OPENROUTER_API_KEY not found in environment variables');
    }
    if (!this.featherlessApiKey) {
      console.warn('⚠️  FEATHERLESS_API_KEY not found in environment variables');
    }
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
   * @param {string} provider - 'openrouter' or 'featherless'
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
  async createChatCompletion({ messages, characterData, characterId = null, model = null, userId = null, userName = null, maxTokens = null, currentStatus = null, userBio = null, schedule = null, isDeparting = false, isProactive = false, proactiveType = null, decision = null, gapHours = null, isFirstMessage = false, matchedDate = null }) {
    try {
      const systemPrompt = promptBuilderService.buildSystemPrompt(characterData, characterId, currentStatus, userBio, schedule, isDeparting, isProactive, proactiveType, decision, gapHours, matchedDate, userName);
      const userSettings = llmSettingsService.getUserSettings(userId);
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
        originalMessageCount: messages.length
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
        { role: 'system', content: systemPrompt },
        ...olderMessages
      ];

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
        const proactiveInstructions = promptBuilderService.buildProactiveInstructions(proactiveType, gapHours, isFirstMessage);
        finalMessages.push({ role: 'system', content: proactiveInstructions });
      }

      // Append current status and schedule activities
      const contextParts = [];

      if (currentStatus) {
        const currentStatusMessage = promptBuilderService.buildCurrentStatus(currentStatus);
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

      // Add character name prompt at the very end to prime the response
      // If sending image/voice, add tags on first line, then character name on second line
      const characterName = characterData.data?.name || characterData.name || 'Character';
      let primeContent = `${characterName}: `;

      if (decision) {
        if (decision.shouldSendImage && decision.imageTags) {
          primeContent = `${characterName}: [IMAGE: ${decision.imageTags}]\n${characterName}: `;
        } else if (decision.shouldSendVoice) {
          primeContent = `${characterName}: [VOICE]\n${characterName}: `;
        }
      }

      finalMessages.push({ role: 'assistant', content: primeContent, prefix: true });

      // Log prompt for debugging (keep last 5) - log the ACTUAL messages being sent
      const logUserName = userName || 'User';
      const messageType = isProactive ? `proactive-${proactiveType}${isFirstMessage ? '-first' : ''}` : 'chat';
      const logId = this.savePromptLog(finalMessages, messageType, characterName, logUserName);

      // Build request body (provider-agnostic base parameters)
      const requestBody = {
        model: selectedModel,
        messages: finalMessages,
        temperature: userSettings.temperature,
        max_tokens: effectiveMaxTokens,
        top_p: userSettings.top_p,
        frequency_penalty: userSettings.frequency_penalty,
        presence_penalty: userSettings.presence_penalty,
      };

      // Add Featherless-specific parameters if using Featherless
      if (provider === 'featherless') {
        // Featherless supports additional sampling parameters
        requestBody.repetition_penalty = userSettings.repetition_penalty ?? 1.0;
        requestBody.top_k = userSettings.top_k ?? -1;
        requestBody.min_p = userSettings.min_p ?? 0.0;
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
                timeout: 120000 // 120 second timeout
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

      // Strip any <think></think> tags (reasoning/thinking output from models that use tags)
      // First remove complete pairs, then remove any stray opening or closing tags
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      content = content.replace(/<\/?think>/gi, '').trim();

      // Log reasoning for debugging if present
      if (reasoning) {
        console.log('🧠 REASONING DETECTED:', reasoning);
      }

      // Strip any leading "Name: " pattern (AI priming artifact)
      // Example: "Jane Doe: message" -> "message"
      // Only matches names (letters, spaces, hyphens, apostrophes), NOT brackets or special chars
      // Multiline mode: strips from start of each line, not just start of entire string
      while (content.match(/^[A-Za-z\s'-]+:\s*/m)) {
        content = content.replace(/^[A-Za-z\s'-]+:\s*/gm, '');
      }

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
    // Use user's Content LLM settings if userId provided, otherwise use defaults
    const userSettings = options.userId
      ? llmSettingsService.getUserSettings(options.userId)
      : llmSettingsService.getDefaultContentSettings();

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

    // Add Featherless-specific parameters if using Featherless
    if (provider === 'featherless') {
      requestBody.repetition_penalty = options.repetition_penalty ?? 1.0;
      requestBody.top_k = options.top_k ?? -1;
      requestBody.min_p = options.min_p ?? 0.0;
    }

    // Add reasoning if provided (for DeepSeek reasoning mode on OpenRouter)
    if (options.reasoning_effort && provider === 'openrouter') {
      requestBody.reasoning = {
        effort: options.reasoning_effort
      };
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
              timeout: 120000 // 120 second timeout
            }
          );
        });

        const message = response.data.choices[0].message;
        const rawContent = message.content; // Save raw content before processing
        let content = message.content;

        // Strip any <think></think> tags (reasoning/thinking output from some models)
        // First remove complete pairs, then remove any stray opening or closing tags
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        content = content.replace(/<\/?think>/gi, '').trim();

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
    const systemPrompt = promptBuilderService.buildSystemPrompt(characterData, currentStatus, userBio, schedule);
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
              timeout: 120000 // 120 second timeout
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
