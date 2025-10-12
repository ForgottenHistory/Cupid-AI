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
               llm_frequency_penalty, llm_presence_penalty, llm_context_window
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
        context_window: settings.llm_context_window ?? 4000
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
               decision_llm_frequency_penalty, decision_llm_presence_penalty, decision_llm_context_window
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
        context_window: settings.decision_llm_context_window ?? 2000
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
      context_window: 4000
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
      context_window: 2000
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
               imagetag_llm_frequency_penalty, imagetag_llm_presence_penalty
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
        presence_penalty: settings.imagetag_llm_presence_penalty ?? 0.0
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
      presence_penalty: 0.0
    };
  }
}

export default new LLMSettingsService();
