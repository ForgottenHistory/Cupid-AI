import axios from 'axios';
import FormData from 'form-data';

class TTSService {
  constructor() {
    this.ttsServerUrl = process.env.TTS_SERVER_URL || 'http://localhost:5000';
  }

  /**
   * Helper to check if an error is retryable
   */
  isRetryableError(error) {
    const status = error.response?.status;
    const code = error.code;
    // Retry on: 429 (rate limit), 500, 502, 503, 504 (server errors), ECONNRESET, ETIMEDOUT
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504 ||
           code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED';
  }

  /**
   * Helper to wait/sleep for a duration
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate TTS audio and return audio URL
   */
  async generateVoiceMessage({ text, voiceId, exaggeration = 0.2, cfgWeight = 0.8 }) {
    try {
      console.log(`🎙️  Generating voice message for voice: ${voiceId}`);

      const formData = new FormData();
      formData.append('text', text);
      if (voiceId) {
        formData.append('voice_name', voiceId);
      }
      formData.append('exaggeration', String(exaggeration));
      formData.append('cfg_weight', String(cfgWeight));

      // Make request with retry logic
      const maxRetries = 3;
      let lastError = null;
      let response = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          response = await axios.post(`${this.ttsServerUrl}/generate`, formData, {
            headers: {
              ...formData.getHeaders()
            },
            responseType: 'arraybuffer',
            timeout: 60000 // 60 second timeout
          });

          // Success! Break out of retry loop
          if (attempt > 0) {
            console.log(`✅ TTS generation succeeded after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}`);
          }
          break;
        } catch (error) {
          lastError = error;
          const status = error.response?.status;
          const code = error.code;

          // Check if error is retryable
          if (attempt < maxRetries && this.isRetryableError(error)) {
            // Calculate exponential backoff: 1s, 2s, 4s
            const delayMs = Math.pow(2, attempt) * 1000;
            console.warn(`⚠️  TTS generation failed (${status || code}), retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
            await this.sleep(delayMs);
            continue; // Retry
          }

          // Non-retryable error or max retries exceeded
          throw error;
        }
      }

      // If we exhausted retries without success
      if (!response) {
        throw lastError;
      }

      console.log(`✅ Voice message generated (${response.data.byteLength} bytes)`);

      return {
        audioBuffer: response.data,
        success: true
      };
    } catch (error) {
      console.error('❌ TTS generation error:', {
        message: error.message,
        voiceId: voiceId,
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if TTS server is available
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.ttsServerUrl}/`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error('TTS server health check failed:', error.message);
      return null;
    }
  }
}

export default new TTSService();
