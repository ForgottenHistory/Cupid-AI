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
        SELECT llm_model, llm_temperature, llm_max_tokens, llm_top_p,
               llm_frequency_penalty, llm_presence_penalty, llm_context_window
        FROM users WHERE id = ?
      `).get(userId);

      if (!settings) {
        return this.getDefaultContentSettings();
      }

      return {
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
        SELECT decision_llm_model, decision_llm_temperature, decision_llm_max_tokens, decision_llm_top_p,
               decision_llm_frequency_penalty, decision_llm_presence_penalty, decision_llm_context_window
        FROM users WHERE id = ?
      `).get(userId);

      if (!settings) {
        return this.getDefaultDecisionSettings();
      }

      return {
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
      model: this.defaultModel,
      temperature: 0.7,
      max_tokens: 500,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      context_window: 2000
    };
  }
}

export default new LLMSettingsService();
