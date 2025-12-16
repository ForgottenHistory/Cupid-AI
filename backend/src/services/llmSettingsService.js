import db from '../db/database.js';

class LLMSettingsService {
  constructor() {
    this.defaultModel = 'deepseek/deepseek-chat-v3';
  }

  /**
   * Get user's Content LLM settings from database
   */
  getUserSettings(userId) {
    if (!userId) {
      return {
        provider: 'openrouter',
        model: this.defaultModel,
        temperature: 0.8,
        max_tokens: 800,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        context_window: 4000
      };
    }

    try {
      const settings = db.prepare(`
        SELECT llm_provider, llm_model, llm_temperature, llm_max_tokens, llm_top_p,
               llm_frequency_penalty, llm_presence_penalty, llm_context_window,
               llm_top_k, llm_repetition_penalty, llm_min_p, llm_request_timeout
        FROM users WHERE id = ?
      `).get(userId);

      if (!settings) {
        return this.getDefaultContentSettings();
      }

      return {
        provider: settings.llm_provider || 'openrouter',
        model: settings.llm_model || this.defaultModel,
        temperature: settings.llm_temperature ?? 0.8,
        max_tokens: settings.llm_max_tokens ?? 800,
        top_p: settings.llm_top_p ?? 1.0,
        frequency_penalty: settings.llm_frequency_penalty ?? 0.0,
        presence_penalty: settings.llm_presence_penalty ?? 0.0,
        context_window: settings.llm_context_window ?? 4000,
        top_k: settings.llm_top_k ?? -1,
        repetition_penalty: settings.llm_repetition_penalty ?? 1.0,
        min_p: settings.llm_min_p ?? 0.0,
        request_timeout: settings.llm_request_timeout ?? 120
      };
    } catch (error) {
      console.error('Error fetching user LLM settings:', error);
      return this.getDefaultContentSettings();
    }
  }

  /**
   * Get user's Decision LLM settings from database
   */
  getDecisionSettings(userId) {
    if (!userId) {
      return this.getDefaultDecisionSettings();
    }

    try {
      const settings = db.prepare(`
        SELECT decision_llm_provider, decision_llm_model, decision_llm_temperature, decision_llm_max_tokens, decision_llm_top_p,
               decision_llm_frequency_penalty, decision_llm_presence_penalty, decision_llm_context_window,
               decision_llm_top_k, decision_llm_repetition_penalty, decision_llm_min_p, decision_llm_request_timeout
        FROM users WHERE id = ?
      `).get(userId);

      if (!settings) {
        return this.getDefaultDecisionSettings();
      }

      return {
        provider: settings.decision_llm_provider || 'openrouter',
        model: settings.decision_llm_model || this.defaultModel,
        temperature: settings.decision_llm_temperature ?? 0.7,
        max_tokens: settings.decision_llm_max_tokens ?? 500,
        top_p: settings.decision_llm_top_p ?? 1.0,
        frequency_penalty: settings.decision_llm_frequency_penalty ?? 0.0,
        presence_penalty: settings.decision_llm_presence_penalty ?? 0.0,
        context_window: settings.decision_llm_context_window ?? 2000,
        top_k: settings.decision_llm_top_k ?? -1,
        repetition_penalty: settings.decision_llm_repetition_penalty ?? 1.0,
        min_p: settings.decision_llm_min_p ?? 0.0,
        request_timeout: settings.decision_llm_request_timeout ?? 120
      };
    } catch (error) {
      console.error('Error fetching user Decision LLM settings:', error);
      return this.getDefaultDecisionSettings();
    }
  }

  /**
   * Get default content LLM settings
   */
  getDefaultContentSettings() {
    return {
      provider: 'openrouter',
      model: this.defaultModel,
      temperature: 0.8,
      max_tokens: 800,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      context_window: 4000,
      top_k: -1,
      repetition_penalty: 1.0,
      min_p: 0.0,
      request_timeout: 120
    };
  }

  /**
   * Get default decision LLM settings
   */
  getDefaultDecisionSettings() {
    return {
      provider: 'openrouter',
      model: this.defaultModel,
      temperature: 0.7,
      max_tokens: 500,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      context_window: 2000,
      top_k: -1,
      repetition_penalty: 1.0,
      min_p: 0.0,
      request_timeout: 120
    };
  }

  /**
   * Get user's Image Tag LLM settings from database
   */
  getImageTagSettings(userId) {
    if (!userId) {
      return this.getDefaultImageTagSettings();
    }

    try {
      const settings = db.prepare(`
        SELECT imagetag_llm_provider, imagetag_llm_model, imagetag_llm_temperature, imagetag_llm_max_tokens, imagetag_llm_top_p,
               imagetag_llm_frequency_penalty, imagetag_llm_presence_penalty,
               imagetag_llm_top_k, imagetag_llm_repetition_penalty, imagetag_llm_min_p, imagetag_llm_request_timeout
        FROM users WHERE id = ?
      `).get(userId);

      if (!settings) {
        return this.getDefaultImageTagSettings();
      }

      return {
        provider: settings.imagetag_llm_provider || 'openrouter',
        model: settings.imagetag_llm_model || 'x-ai/grok-4-fast',
        temperature: settings.imagetag_llm_temperature ?? 0.7,
        max_tokens: settings.imagetag_llm_max_tokens ?? 4000,
        top_p: settings.imagetag_llm_top_p ?? 1.0,
        frequency_penalty: settings.imagetag_llm_frequency_penalty ?? 0.0,
        presence_penalty: settings.imagetag_llm_presence_penalty ?? 0.0,
        top_k: settings.imagetag_llm_top_k ?? -1,
        repetition_penalty: settings.imagetag_llm_repetition_penalty ?? 1.0,
        min_p: settings.imagetag_llm_min_p ?? 0.0,
        request_timeout: settings.imagetag_llm_request_timeout ?? 120
      };
    } catch (error) {
      console.error('Error fetching user Image Tag LLM settings:', error);
      return this.getDefaultImageTagSettings();
    }
  }

  /**
   * Get default image tag LLM settings
   */
  getDefaultImageTagSettings() {
    return {
      provider: 'openrouter',
      model: 'x-ai/grok-4-fast',
      temperature: 0.7,
      max_tokens: 4000,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      top_k: -1,
      repetition_penalty: 1.0,
      min_p: 0.0,
      request_timeout: 120
    };
  }

  /**
   * Get user's Metadata LLM settings from database
   */
  getMetadataSettings(userId) {
    if (!userId) {
      return this.getDefaultMetadataSettings();
    }

    try {
      const settings = db.prepare(`
        SELECT metadata_llm_provider, metadata_llm_model, metadata_llm_temperature, metadata_llm_max_tokens, metadata_llm_top_p,
               metadata_llm_frequency_penalty, metadata_llm_presence_penalty, metadata_llm_context_window,
               metadata_llm_top_k, metadata_llm_repetition_penalty, metadata_llm_min_p, metadata_llm_request_timeout
        FROM users WHERE id = ?
      `).get(userId);

      if (!settings) {
        return this.getDefaultMetadataSettings();
      }

      return {
        provider: settings.metadata_llm_provider || 'openrouter',
        model: settings.metadata_llm_model || this.defaultModel,
        temperature: settings.metadata_llm_temperature ?? 0.8,
        max_tokens: settings.metadata_llm_max_tokens ?? 4000,
        top_p: settings.metadata_llm_top_p ?? 1.0,
        frequency_penalty: settings.metadata_llm_frequency_penalty ?? 0.0,
        presence_penalty: settings.metadata_llm_presence_penalty ?? 0.0,
        context_window: settings.metadata_llm_context_window ?? 8000,
        top_k: settings.metadata_llm_top_k ?? -1,
        repetition_penalty: settings.metadata_llm_repetition_penalty ?? 1.0,
        min_p: settings.metadata_llm_min_p ?? 0.0,
        request_timeout: settings.metadata_llm_request_timeout ?? 120
      };
    } catch (error) {
      console.error('Error fetching user Metadata LLM settings:', error);
      return this.getDefaultMetadataSettings();
    }
  }

  /**
   * Get default metadata LLM settings
   */
  getDefaultMetadataSettings() {
    return {
      provider: 'openrouter',
      model: this.defaultModel,
      temperature: 0.8,
      max_tokens: 4000,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      context_window: 8000,
      top_k: -1,
      repetition_penalty: 1.0,
      min_p: 0.0,
      request_timeout: 120
    };
  }
}

export default new LLMSettingsService();
