import db from '../db/database.js';

/**
 * LLM parameter validation rules
 */
const LLM_VALIDATION_RULES = {
  provider: { validate: (v) => ['openrouter', 'featherless', 'nanogpt'].includes(v), error: 'Provider must be openrouter, featherless, or nanogpt' },
  temperature: { validate: (v) => v >= 0 && v <= 2, error: 'Temperature must be between 0 and 2' },
  maxTokens: { validate: (v) => v >= 1 && v <= 16000, error: 'Max tokens must be between 1 and 16000' },
  topP: { validate: (v) => v >= 0 && v <= 1, error: 'Top P must be between 0 and 1' },
  frequencyPenalty: { validate: (v) => v >= -2 && v <= 2, error: 'Frequency penalty must be between -2 and 2' },
  presencePenalty: { validate: (v) => v >= -2 && v <= 2, error: 'Presence penalty must be between -2 and 2' },
  contextWindow: { validate: (v) => v >= 1000 && v <= 200000, error: 'Context window must be between 1000 and 200000' },
  topK: { validate: (v) => v >= -1, error: 'Top K must be -1 or greater' },
  repetitionPenalty: { validate: (v) => v >= 0 && v <= 2, error: 'Repetition penalty must be between 0 and 2' },
  minP: { validate: (v) => v >= 0 && v <= 1, error: 'Min P must be between 0 and 1' },
  requestTimeout: { validate: (v) => v >= 10 && v <= 600, error: 'Request timeout must be between 10 and 600 seconds' }
};

/**
 * Map from camelCase field names to database column suffixes
 */
const FIELD_TO_DB_SUFFIX = {
  provider: 'provider',
  model: 'model',
  temperature: 'temperature',
  maxTokens: 'max_tokens',
  topP: 'top_p',
  frequencyPenalty: 'frequency_penalty',
  presencePenalty: 'presence_penalty',
  contextWindow: 'context_window',
  topK: 'top_k',
  repetitionPenalty: 'repetition_penalty',
  minP: 'min_p',
  requestTimeout: 'request_timeout'
};

/**
 * LLM type configurations
 */
const LLM_TYPES = {
  content: {
    prefix: 'llm',
    fields: ['provider', 'model', 'temperature', 'maxTokens', 'topP', 'frequencyPenalty', 'presencePenalty', 'contextWindow', 'topK', 'repetitionPenalty', 'minP', 'requestTimeout']
  },
  decision: {
    prefix: 'decision_llm',
    fields: ['provider', 'model', 'temperature', 'maxTokens', 'topP', 'frequencyPenalty', 'presencePenalty', 'contextWindow', 'topK', 'repetitionPenalty', 'minP', 'requestTimeout']
  },
  imagetag: {
    prefix: 'imagetag_llm',
    fields: ['provider', 'model', 'temperature', 'maxTokens', 'topP', 'frequencyPenalty', 'presencePenalty', 'topK', 'repetitionPenalty', 'minP', 'requestTimeout']
  },
  metadata: {
    prefix: 'metadata_llm',
    fields: ['provider', 'model', 'temperature', 'maxTokens', 'topP', 'frequencyPenalty', 'presencePenalty', 'contextWindow', 'topK', 'repetitionPenalty', 'minP', 'requestTimeout']
  }
};

class UserSettingsService {
  /**
   * Get database column name for a field
   */
  getColumnName(prefix, field) {
    const suffix = FIELD_TO_DB_SUFFIX[field];
    return `${prefix}_${suffix}`;
  }

  /**
   * Get LLM settings for a user
   */
  getLLMSettings(userId, llmType) {
    const config = LLM_TYPES[llmType];
    if (!config) {
      throw new Error(`Unknown LLM type: ${llmType}`);
    }

    const columns = config.fields.map(field => this.getColumnName(config.prefix, field));
    const query = `SELECT ${columns.join(', ')} FROM users WHERE id = ?`;
    const row = db.prepare(query).get(userId);

    if (!row) {
      return null;
    }

    // Map database columns back to camelCase
    const result = {};
    for (const field of config.fields) {
      const columnName = this.getColumnName(config.prefix, field);
      result[field] = row[columnName];
    }

    // Default provider to openrouter if not set
    if (result.provider === null || result.provider === undefined) {
      result.provider = 'openrouter';
    }

    return result;
  }

  /**
   * Validate LLM settings
   * Returns { valid: true } or { valid: false, error: string }
   */
  validateLLMSettings(settings, llmType) {
    const config = LLM_TYPES[llmType];
    if (!config) {
      return { valid: false, error: `Unknown LLM type: ${llmType}` };
    }

    for (const [field, value] of Object.entries(settings)) {
      if (value === undefined) continue;
      if (!config.fields.includes(field)) continue;

      const rule = LLM_VALIDATION_RULES[field];
      if (rule && !rule.validate(value)) {
        return { valid: false, error: rule.error };
      }
    }

    return { valid: true };
  }

  /**
   * Update LLM settings for a user
   */
  updateLLMSettings(userId, settings, llmType) {
    const config = LLM_TYPES[llmType];
    if (!config) {
      throw new Error(`Unknown LLM type: ${llmType}`);
    }

    const updates = [];
    const values = [];

    for (const field of config.fields) {
      if (settings[field] !== undefined) {
        updates.push(`${this.getColumnName(config.prefix, field)} = ?`);
        values.push(settings[field]);
      }
    }

    if (updates.length === 0) {
      return null;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    return this.getLLMSettings(userId, llmType);
  }
}

export default new UserSettingsService();
export { LLM_TYPES, LLM_VALIDATION_RULES };
