import { encode } from 'gpt-tokenizer';

class TokenService {
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
}

export default new TokenService();
