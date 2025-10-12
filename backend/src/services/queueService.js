/**
 * Queue Service for managing AI provider concurrency limits
 * Prevents exceeding provider concurrency limits by queueing requests
 */
class QueueService {
  constructor() {
    // Track active requests per provider
    this.activeRequests = {
      openrouter: 0,
      featherless: 0
    };

    // Queue for pending requests per provider
    this.queues = {
      openrouter: [],
      featherless: []
    };

    // Concurrency limits per provider
    this.limits = {
      openrouter: 100, // OpenRouter has very high limits
      featherless: 1   // Featherless has strict limits (1 request at a time)
    };
  }

  /**
   * Execute a function with queue management
   * @param {string} provider - 'openrouter' or 'featherless'
   * @param {Function} fn - Async function to execute
   * @returns {Promise} Result of the function
   */
  async enqueue(provider, fn) {
    const normalizedProvider = provider?.toLowerCase() || 'openrouter';

    // If under limit, execute immediately
    if (this.activeRequests[normalizedProvider] < this.limits[normalizedProvider]) {
      return this.executeRequest(normalizedProvider, fn);
    }

    // Otherwise, queue it
    console.log(`⏳ Queue: ${normalizedProvider} at capacity (${this.activeRequests[normalizedProvider]}/${this.limits[normalizedProvider]}), queueing request...`);

    return new Promise((resolve, reject) => {
      this.queues[normalizedProvider].push({
        fn,
        resolve,
        reject
      });
      console.log(`📝 Queue: ${normalizedProvider} now has ${this.queues[normalizedProvider].length} pending request(s)`);
    });
  }

  /**
   * Execute a request and manage concurrency tracking
   */
  async executeRequest(provider, fn) {
    this.activeRequests[provider]++;
    console.log(`🚀 Queue: ${provider} executing (${this.activeRequests[provider]}/${this.limits[provider]} active)`);

    try {
      const result = await fn();
      return result;
    } finally {
      this.activeRequests[provider]--;
      console.log(`✅ Queue: ${provider} completed (${this.activeRequests[provider]}/${this.limits[provider]} active)`);

      // Process next queued request if any
      this.processNext(provider);
    }
  }

  /**
   * Process the next queued request for a provider
   */
  processNext(provider) {
    if (this.queues[provider].length === 0) {
      return;
    }

    if (this.activeRequests[provider] >= this.limits[provider]) {
      return;
    }

    const { fn, resolve, reject } = this.queues[provider].shift();
    console.log(`▶️  Queue: ${provider} processing next queued request (${this.queues[provider].length} remaining)`);

    this.executeRequest(provider, fn)
      .then(resolve)
      .catch(reject);
  }

  /**
   * Get queue status for monitoring
   */
  getStatus() {
    return {
      openrouter: {
        active: this.activeRequests.openrouter,
        queued: this.queues.openrouter.length,
        limit: this.limits.openrouter
      },
      featherless: {
        active: this.activeRequests.featherless,
        queued: this.queues.featherless.length,
        limit: this.limits.featherless
      }
    };
  }
}

export default new QueueService();
