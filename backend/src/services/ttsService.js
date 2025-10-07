import axios from 'axios';
import FormData from 'form-data';

class TTSService {
  constructor() {
    this.ttsServerUrl = process.env.TTS_SERVER_URL || 'http://localhost:5000';
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

      const response = await axios.post(`${this.ttsServerUrl}/generate`, formData, {
        headers: {
          ...formData.getHeaders()
        },
        responseType: 'arraybuffer',
        timeout: 60000 // 60 second timeout
      });

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
