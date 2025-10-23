import { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * Custom hook for managing LLM settings (Content, Decision, or Image Tag)
 * @param {string} type - 'content', 'decision', or 'imagetag'
 * @returns {Object} Settings state and handlers
 */
export const useLLMSettings = (type) => {
  const [settings, setSettings] = useState(getDefaultSettings(type));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSettings();
  }, [type]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const endpoint = type === 'content' ? '/users/llm-settings' : type === 'decision' ? '/users/decision-llm-settings' : '/users/imagetag-llm-settings';
      const response = await api.get(endpoint);
      setSettings(response.data);
    } catch (err) {
      console.error(`Failed to load ${type} LLM settings:`, err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const endpoint = type === 'content' ? '/users/llm-settings' : type === 'decision' ? '/users/decision-llm-settings' : '/users/imagetag-llm-settings';
      await api.put(endpoint, settings);
      setSuccess('Settings saved successfully!');
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      console.error(`Failed to save ${type} LLM settings:`, err);
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (field, value) => {
    setSettings({ ...settings, [field]: value });
    setError('');
    setSuccess('');
  };

  const resetToDefaults = () => {
    setSettings(getDefaultSettings(type));
    setError('');
    setSuccess('');
  };

  return {
    settings,
    loading,
    saving,
    error,
    success,
    updateSetting,
    saveSettings,
    resetToDefaults
  };
};

/**
 * Get default settings based on type
 */
function getDefaultSettings(type) {
  if (type === 'content') {
    return {
      provider: 'openrouter',
      model: 'deepseek/deepseek-chat-v3',
      temperature: 0.8,
      maxTokens: 800,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      contextWindow: 4000,
      topK: -1,
      repetitionPenalty: 1.0,
      minP: 0.0,
    };
  } else if (type === 'decision') {
    return {
      provider: 'openrouter',
      model: 'deepseek/deepseek-chat-v3',
      temperature: 0.7,
      maxTokens: 500,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      contextWindow: 2000,
      topK: -1,
      repetitionPenalty: 1.0,
      minP: 0.0,
    };
  } else if (type === 'imagetag') {
    return {
      provider: 'openrouter',
      model: 'x-ai/grok-4-fast',
      temperature: 0.7,
      maxTokens: 4000,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      topK: -1,
      repetitionPenalty: 1.0,
      minP: 0.0,
    };
  }
}
