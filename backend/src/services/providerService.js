/**
 * Service for managing LLM provider configurations
 */
class ProviderService {
  constructor() {
    this.openrouterApiKey = process.env.OPENROUTER_API_KEY;
    this.featherlessApiKey = process.env.FEATHERLESS_API_KEY;
    this.nanogptApiKey = process.env.NANOGPT_API_KEY;
    this.openrouterBaseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.featherlessBaseUrl = 'https://api.featherless.ai/v1';
    this.nanogptBaseUrl = 'https://nano-gpt.com/api/v1';

    this.logMissingKeys();
  }

  /**
   * Log warnings for missing API keys
   */
  logMissingKeys() {
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
   * Check if an error is retryable (rate limit or server error)
   * @param {Error} error - The error to check
   * @returns {boolean} True if the error is retryable
   */
  isRetryableError(error) {
    const status = error.response?.status;
    // Retry on: 429 (rate limit), 500, 502, 503, 504 (server errors)
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
  }

  /**
   * Sleep/wait for a duration
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Resolves after the duration
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute a request with exponential backoff retry logic
   * @param {Function} requestFn - Async function that performs the request
   * @param {string} providerName - Provider name for logging
   * @param {number} maxRetries - Maximum number of retries (default: 3)
   * @returns {Promise} The response from the request
   */
  async executeWithRetry(requestFn, providerName, maxRetries = 3) {
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await requestFn();

        if (attempt > 0) {
          console.log(`✅ ${providerName} request succeeded after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}`);
        }

        return response;
      } catch (error) {
        lastError = error;
        const status = error.response?.status;

        // Check if error is retryable
        if (attempt < maxRetries && this.isRetryableError(error)) {
          // Calculate exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt) * 1000;
          console.warn(`⚠️  ${providerName} request failed (${status || error.code}), retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
          await this.sleep(delayMs);
          continue;
        }

        // Non-retryable error or max retries exceeded
        break;
      }
    }

    // All retries failed
    throw lastError;
  }
}

export default new ProviderService();
