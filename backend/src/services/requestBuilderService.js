/**
 * Service for building provider-specific API request bodies
 */
class RequestBuilderService {
  /**
   * Build request body for chat completion
   * @param {Object} options - Request options
   * @returns {Object} Request body ready for API
   */
  buildChatRequestBody(options) {
    const {
      model,
      messages,
      temperature,
      maxTokens,
      topP,
      frequencyPenalty,
      presencePenalty,
      repetitionPenalty,
      topK,
      minP,
      reasoningEffort,
      provider
    } = options;

    const requestBody = {
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
      top_p: topP,
    };

    // Add provider-specific parameters
    this.addProviderParams(requestBody, provider, {
      frequencyPenalty,
      presencePenalty,
      repetitionPenalty,
      topK,
      minP,
      reasoningEffort
    });

    return requestBody;
  }

  /**
   * Build request body for basic completion
   * @param {Object} options - Request options
   * @returns {Object} Request body ready for API
   */
  buildBasicRequestBody(options) {
    const {
      model,
      prompt,
      temperature,
      maxTokens,
      topP,
      frequencyPenalty,
      presencePenalty,
      repetitionPenalty,
      topK,
      minP,
      reasoningEffort,
      provider
    } = options;

    const requestBody = {
      model: model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: temperature,
      max_tokens: maxTokens,
      top_p: topP ?? 1.0,
      frequency_penalty: frequencyPenalty ?? 0.0,
      presence_penalty: presencePenalty ?? 0.0,
    };

    // Add extended sampling parameters for supported providers
    if (provider === 'featherless' || provider === 'openrouter' || provider === 'nanogpt') {
      const repPenalty = repetitionPenalty ?? 1.0;
      const topKVal = topK ?? -1;
      const minPVal = minP ?? 0.0;

      if (repPenalty !== 1.0) {
        requestBody.repetition_penalty = repPenalty;
      }
      if (topKVal !== -1) {
        requestBody.top_k = topKVal;
      }
      if (minPVal !== 0.0) {
        requestBody.min_p = minPVal;
      }
    }

    // Add reasoning support
    if (reasoningEffort) {
      if (provider === 'nanogpt') {
        requestBody.reasoning_effort = reasoningEffort;
        requestBody.reasoning = { exclude: true };
      } else if (provider === 'openrouter') {
        requestBody.reasoning = { effort: reasoningEffort };
      }
    }

    return requestBody;
  }

  /**
   * Add provider-specific parameters to request body
   * @param {Object} requestBody - Request body to modify
   * @param {string} provider - Provider name
   * @param {Object} params - Parameters to add
   */
  addProviderParams(requestBody, provider, params) {
    const {
      frequencyPenalty,
      presencePenalty,
      repetitionPenalty,
      topK,
      minP,
      reasoningEffort
    } = params;

    if (provider === 'featherless') {
      // Featherless (vLLM): Use vLLM-native parameters
      const repPenalty = repetitionPenalty ?? 1.0;
      const topKVal = topK ?? -1;
      const minPVal = minP ?? 0.0;

      if (repPenalty !== 1.0) {
        requestBody.repetition_penalty = repPenalty;
      }
      if (topKVal !== -1) {
        requestBody.top_k = topKVal;
      }
      if (minPVal !== 0.0) {
        requestBody.min_p = minPVal;
      }
    } else if (provider === 'nanogpt') {
      // NanoGPT: Supports all extended sampling parameters
      requestBody.frequency_penalty = frequencyPenalty ?? 0.0;
      requestBody.presence_penalty = presencePenalty ?? 0.0;

      const repPenalty = repetitionPenalty ?? 1.0;
      const topKVal = topK ?? -1;
      const minPVal = minP ?? 0.0;

      if (repPenalty !== 1.0) {
        requestBody.repetition_penalty = repPenalty;
      }
      if (topKVal !== -1) {
        requestBody.top_k = topKVal;
      }
      if (minPVal !== 0.0) {
        requestBody.min_p = minPVal;
      }

      // NanoGPT reasoning support
      if (reasoningEffort) {
        requestBody.reasoning_effort = reasoningEffort;
        requestBody.reasoning = { exclude: true };
      }
    } else {
      // OpenRouter: Use OpenAI-style parameters
      requestBody.frequency_penalty = frequencyPenalty ?? 0.0;
      requestBody.presence_penalty = presencePenalty ?? 0.0;
    }
  }

  /**
   * Get request headers for API calls
   * @param {string} apiKey - API key
   * @returns {Object} Headers object
   */
  getRequestHeaders(apiKey) {
    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://localhost:3000',
      'X-Title': 'Cupid-AI',
    };
  }
}

export default new RequestBuilderService();
