import axios from 'axios';
import db from '../db/database.js';
import llmSettingsService from './llmSettingsService.js';
import promptBuilderService from './promptBuilderService.js';
import queueService from './queueService.js';
import providerService from './providerService.js';
import promptLogService from './promptLogService.js';
import chatCompletionBuilder from './chatCompletionBuilder.js';
import requestBuilderService from './requestBuilderService.js';

class AIService {
  /**
   * Estimate token count for messages (rough approximation: 1 token ≈ 4 characters)
   * @param {Array} messages - Array of message objects
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
      totalChars += 10; // overhead for role and structure
    }
    return Math.ceil(totalChars / 4); // 1 token ≈ 4 characters
  }

  /**
   * Strip unwanted formatting from AI response content and validate it's not empty
   * @param {string} content - The response content to process
   * @param {string} rawContent - Original raw content for error context
   * @param {object} options - Options for stripping
   * @param {boolean} options.isChat - If true, apply chat-specific stripping (name prefixes, timestamps, etc.)
   * @returns {string} Processed content
   * @throws {Error} If content is empty or invalid after processing
   */
  stripAndValidateContent(content, rawContent, options = {}) {
    const { isChat = false } = options;

    // Strip any <think></think> tags (reasoning/thinking output from some models)
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // Strip everything before and including </think> BEFORE removing standalone tags
    // (for models that leak reasoning without opening tag)
    const thinkEndIndex = content.lastIndexOf('</think>');
    if (thinkEndIndex !== -1) {
      content = content.substring(thinkEndIndex + '</think>'.length).trim();
    }

    // Now strip any remaining standalone think tags
    content = content.replace(/<\/?think>/gi, '').trim();

    // Chat-specific stripping (not for metadata like schedules, dating profiles, etc.)
    if (isChat) {
      // Strip RP actions wrapped in asterisks (e.g. *leans back*, *sighs*)
      content = content.replace(/\*[^*]+\*/g, '').trim();

      // Strip lines that are just "Name:" or "Name: " with nothing after (empty prefix)
      content = content.replace(/^[^:\n]+:\s*$/gim, '').trim();

      // Strip lines that are just timestamps (e.g. "8:07 PM", "12:30pm")
      content = content.replace(/^\d{1,2}:\d{2}\s*(?:AM|PM)?\s*$/gim, '').trim();

      // Strip lines that are "Name: timestamp" (e.g. "Chisaka Airi: 8:07 PM")
      content = content.replace(/^[^:\n]+:\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\s*$/gim, '').trim();

      // Strip lines with numeric dates (e.g. "12/28/2025", "12/28/2025, 5:14pm")
      content = content.replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}.*$/gim, '').trim();

      // Strip lines with spelled-out dates/days (e.g. "Monday morning.", "Monday, December 29, 2025")
      content = content.replace(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[\s,.].*$/gim, '').trim();

      // Strip blockquote-style lines (lines starting with >)
      content = content.replace(/^>\s*.*/gm, '').trim();
    }

    // Check if content is empty after stripping
    if (!content && rawContent) {
      console.warn('⚠️ Response is empty after stripping formatting');
      throw new Error('Response was empty after stripping formatting.');
    }

    // Chat-specific: Check if content is just a character name followed by colon with nothing after
    if (isChat && /^[^:]+:\s*$/.test(content)) {
      console.warn('⚠️ Response is just character name with colon, no actual content:', content);
      throw new Error('Response was empty - model returned only character name prefix without content.');
    }

    return content;
  }

  /**
   * Process raw response content (strip formatting, remove priming artifacts)
   * @param {string} content - Raw response content
   * @param {string} rawContent - Original raw content for validation
   * @returns {string} Processed content
   */
  processResponseContent(content, rawContent) {
    // Check for incomplete <think> tags (truncated response)
    const openThinkTags = (content.match(/<think>/gi) || []).length;
    const closeThinkTags = (content.match(/<\/think>/gi) || []).length;
    if (openThinkTags > closeThinkTags) {
      console.error('❌ Incomplete <think> tag detected - response truncated');
      throw new Error('Response contains incomplete <think> tag - response was truncated. Please retry or increase max_tokens.');
    }

    // Strip formatting and validate (isChat: true for chat-specific stripping)
    content = this.stripAndValidateContent(content, rawContent, { isChat: true });

    // Strip any leading "Name: " pattern (AI priming artifact)
    content = content.replace(/^[A-Za-z\s'-]+:\s*/, '');

    // Strip "\nName: ..." pattern and everything after
    content = content.replace(/\n[A-Za-z\s'-]+:\s*[\s\S]*$/, '').trim();

    // Strip any text in square brackets
    content = content.replace(/^\[.*?\]\s*$/gm, '').replace(/\[.*?\]/g, '').trim();

    return content;
  }

  /**
   * Send a chat completion request to AI provider
   */
  async createChatCompletion({ messages, characterData, characterId = null, model = null, userId = null, userName = null, maxTokens = null, currentStatus = null, userBio = null, schedule = null, isDeparting = false, isProactive = false, proactiveType = null, decision = null, gapHours = null, isFirstMessage = false, matchedDate = null, characterMood = null, characterState = null }) {
    try {
      const systemPrompt = promptBuilderService.buildSystemPrompt(characterData, characterId, currentStatus, userBio, schedule, isDeparting, isProactive, proactiveType, decision, gapHours, matchedDate, userName, userId);
      const userSettings = llmSettingsService.getUserSettings(userId);

      // Get settings
      const behaviorSettings = db.prepare('SELECT include_full_schedule, use_name_primer FROM users WHERE id = ?').get(userId);
      const includeFullSchedule = behaviorSettings?.include_full_schedule === 1;
      const useNamePrimer = behaviorSettings?.use_name_primer !== 0; // Default to true if not set
      const selectedModel = model || userSettings.model;
      const effectiveMaxTokens = maxTokens || userSettings.max_tokens;
      const provider = userSettings.provider || 'openrouter';

      // Get provider configuration
      const providerConfig = providerService.getProviderConfig(provider);
      if (!providerConfig.apiKey) {
        throw new Error(`${providerConfig.name} API key not configured`);
      }

      // Build messages array
      const { finalMessages, trimmedMessages } = chatCompletionBuilder.buildMessages({
        messages,
        systemPrompt,
        contextWindow: userSettings.context_window,
        maxTokens: effectiveMaxTokens,
        includeFullSchedule,
        schedule,
        currentStatus,
        characterMood,
        characterState,
        userId,
        isProactive,
        proactiveType,
        gapHours,
        isFirstMessage,
        characterId,
        characterData,
        decision,
        userName,
        useNamePrimer
      });

      console.log(`🤖 ${providerConfig.name} Request:`, {
        provider,
        model: selectedModel,
        temperature: userSettings.temperature,
        max_tokens: effectiveMaxTokens,
        context_window: userSettings.context_window,
        messageCount: trimmedMessages.length + 1,
        originalMessageCount: messages.length,
        llmType: 'content'
      });

      // Build request body
      const requestBody = requestBuilderService.buildChatRequestBody({
        model: selectedModel,
        messages: finalMessages,
        temperature: userSettings.temperature,
        maxTokens: effectiveMaxTokens,
        topP: userSettings.top_p,
        frequencyPenalty: userSettings.frequency_penalty,
        presencePenalty: userSettings.presence_penalty,
        repetitionPenalty: userSettings.repetition_penalty,
        topK: userSettings.top_k,
        minP: userSettings.min_p,
        reasoningEffort: userSettings.reasoning_effort,
        provider
      });

      // Log prompt
      const characterName = characterData.data?.name || characterData.name || 'Character';
      const logUserName = userName || 'User';
      const messageType = isProactive ? `proactive-${proactiveType}${isFirstMessage ? '-first' : ''}` : 'chat';
      const logId = promptLogService.savePromptLog(finalMessages, messageType, characterName, logUserName);

      // Execute request with provider retry (for network/API errors)
      const response = await providerService.executeWithRetry(
        () => queueService.enqueue(provider, () =>
          axios.post(
            `${providerConfig.baseUrl}/chat/completions`,
            requestBody,
            {
              headers: requestBuilderService.getRequestHeaders(providerConfig.apiKey),
              timeout: (userSettings.request_timeout || 120) * 1000
            }
          )
        ),
        providerConfig.name
      );

      // Process response
      const message = response.data.choices[0].message;
      const rawContent = message.content;
      const reasoning = message.reasoning || null;

      let content = this.processResponseContent(message.content, rawContent);

      if (reasoning) {
        console.log('🧠 REASONING DETECTED:', reasoning);
      }

      console.log(`✅ ${providerConfig.name} Response:`, {
        provider,
        model: response.data.model,
        contentLength: content?.length || 0,
        usage: response.data.usage,
        hasReasoning: !!reasoning
      });

      // Log response
      promptLogService.saveResponseLog(content, rawContent, messageType, logId, response.data);

      return {
        content,
        model: response.data.model,
        usage: response.data.usage,
        reasoning
      };
    } catch (error) {
      const userSettings = llmSettingsService.getUserSettings(userId);
      const provider = userSettings.provider || 'openrouter';
      const providerConfig = providerService.getProviderConfig(provider);

      console.error(`❌ ${providerConfig.name} API error:`, {
        provider,
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
   * Basic completion for simple tasks (post generation, etc.)
   * No character context, just a simple prompt → response
   */
  async createBasicCompletion(prompt, options = {}) {
    const llmType = options.llmType || 'content';

    // Get user settings based on LLM type
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

    const providerConfig = providerService.getProviderConfig(provider);
    if (!providerConfig.apiKey) {
      throw new Error(`${providerConfig.name} API key not configured`);
    }

    // Build request body
    const requestBody = requestBuilderService.buildBasicRequestBody({
      model,
      prompt,
      temperature,
      maxTokens: max_tokens,
      topP: options.top_p,
      frequencyPenalty: options.frequency_penalty,
      presencePenalty: options.presence_penalty,
      repetitionPenalty: options.repetition_penalty,
      topK: options.top_k,
      minP: options.min_p,
      reasoningEffort: options.reasoning_effort,
      provider
    });

    // Log prompt if messageType provided
    let logId = null;
    if (options.messageType) {
      logId = promptLogService.savePromptLog(
        requestBody.messages,
        options.messageType,
        options.characterName || 'Character',
        options.userName || 'User'
      );
    }

    try {
      // Execute request with retry
      const response = await providerService.executeWithRetry(
        () => queueService.enqueue(provider, () =>
          axios.post(
            `${providerConfig.baseUrl}/chat/completions`,
            requestBody,
            {
              headers: requestBuilderService.getRequestHeaders(providerConfig.apiKey),
              timeout: options.timeout || (userSettings.request_timeout || 120) * 1000
            }
          )
        ),
        providerConfig.name
      );

      const message = response.data.choices[0].message;
      const rawContent = message.content;
      let content = message.content;

      // Debug empty content
      if ((!content || content.trim() === '') && response.data.usage?.completion_tokens > 0) {
        console.warn('⚠️ Empty content but completion_tokens > 0. Full message object:');
        console.warn(JSON.stringify(message, null, 2));
      }

      // Strip formatting and validate
      content = this.stripAndValidateContent(content, rawContent);

      // Debug reasoning mode
      if (options.reasoning_effort) {
        console.log('🧠 RAW MESSAGE:', JSON.stringify(message, null, 2));
        if (message.reasoning) {
          console.log('🧠 REASONING:', message.reasoning);
        }
      }

      // Log response
      if (logId && options.messageType) {
        promptLogService.saveResponseLog(content, rawContent, options.messageType, logId, response.data);
      }

      return {
        content,
        model: response.data.model,
        usage: response.data.usage,
        reasoning: message.reasoning || null
      };
    } catch (error) {
      console.error(`❌ ${providerConfig.name} basic completion error:`, {
        provider,
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(error.response?.data?.error?.message || error.message || `${providerConfig.name} service error`);
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

    const providerConfig = providerService.getProviderConfig(provider);
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

    try {
      const response = await providerService.executeWithRetry(
        () => queueService.enqueue(provider, () =>
          axios.post(
            `${providerConfig.baseUrl}/chat/completions`,
            requestBody,
            {
              headers: requestBuilderService.getRequestHeaders(providerConfig.apiKey),
              responseType: 'stream',
              timeout: (userSettings.request_timeout || 120) * 1000
            }
          )
        ),
        providerConfig.name
      );

      return response.data;
    } catch (error) {
      console.error(`❌ ${providerConfig.name} stream error:`, {
        provider,
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(error.response?.data?.error?.message || error.message || `${providerConfig.name} service error`);
    }
  }
}

export default new AIService();
