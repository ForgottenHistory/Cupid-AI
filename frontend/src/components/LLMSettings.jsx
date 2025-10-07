import { useState, useEffect } from 'react';
import api from '../services/api';
import axios from 'axios';

const LLMSettings = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('content'); // 'content' or 'decision'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [filterFree, setFilterFree] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [contentSettings, setContentSettings] = useState({
    model: 'deepseek/deepseek-chat-v3',
    temperature: 0.8,
    maxTokens: 800,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    contextWindow: 4000,
  });

  const [decisionSettings, setDecisionSettings] = useState({
    model: 'deepseek/deepseek-chat-v3',
    temperature: 0.7,
    maxTokens: 500,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    contextWindow: 2000,
  });

  const settings = activeTab === 'content' ? contentSettings : decisionSettings;
  const setSettings = activeTab === 'content' ? setContentSettings : setDecisionSettings;

  useEffect(() => {
    loadSettings();
    loadModels();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [contentResponse, decisionResponse] = await Promise.all([
        api.get('/users/llm-settings'),
        api.get('/users/decision-llm-settings')
      ]);
      setContentSettings(contentResponse.data);
      setDecisionSettings(decisionResponse.data);
    } catch (err) {
      console.error('Failed to load LLM settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      setLoadingModels(true);
      const response = await axios.get('https://openrouter.ai/api/v1/models');
      const modelData = response.data.data.map(model => ({
        id: model.id,
        name: model.name,
        pricing: model.pricing,
        context_length: model.context_length,
        isFree: model.pricing?.prompt === '0' || model.id.includes(':free')
      }));
      setModels(modelData);
    } catch (err) {
      console.error('Failed to load models:', err);
      // Fallback to a basic list if API fails
      setModels([
        { id: 'deepseek/deepseek-chat-v3', name: 'DeepSeek Chat v3', isFree: true },
        { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', isFree: true },
      ]);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings({ ...settings, [field]: value });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const endpoint = activeTab === 'content' ? '/users/llm-settings' : '/users/decision-llm-settings';
      await api.put(endpoint, settings);
      setSuccess('Settings saved successfully!');
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      console.error('Failed to save LLM settings:', err);
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    if (activeTab === 'content') {
      setContentSettings({
        model: 'deepseek/deepseek-chat-v3',
        temperature: 0.8,
        maxTokens: 800,
        topP: 1.0,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
        contextWindow: 4000,
      });
    } else {
      setDecisionSettings({
        model: 'deepseek/deepseek-chat-v3',
        temperature: 0.7,
        maxTokens: 500,
        topP: 1.0,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
        contextWindow: 2000,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-pink-500 to-purple-600">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">LLM Settings</h2>
              <p className="text-white/80 text-sm mt-1">Configure AI model and generation parameters</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-full transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => setActiveTab('content')}
            className={`flex-1 px-6 py-3 font-semibold transition ${
              activeTab === 'content'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Content LLM
          </button>
          <button
            onClick={() => setActiveTab('decision')}
            className={`flex-1 px-6 py-3 font-semibold transition ${
              activeTab === 'decision'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Decision LLM
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-14rem)]">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading settings...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Tab Description */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  {activeTab === 'content' ? (
                    <>
                      <strong>Content LLM:</strong> Used to generate character responses and dialogue. This is the main AI that writes what your characters say.
                    </>
                  ) : (
                    <>
                      <strong>Decision LLM:</strong> Used to make behavioral decisions (reactions, mood changes, events). A smaller, faster model is recommended for quick decision-making.
                    </>
                  )}
                </p>
              </div>

              {/* Messages */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  {success}
                </div>
              )}

              {/* Model Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Model
                </label>

                {/* Current Selection Display */}
                {!loadingModels && models.length > 0 && (
                  <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">
                      Currently Selected
                    </div>
                    <div className="font-medium text-gray-900">
                      {models.find(m => m.id === settings.model)?.name || settings.model}
                    </div>
                    {models.find(m => m.id === settings.model)?.isFree && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                        Free
                      </span>
                    )}
                  </div>
                )}

                {/* Search and Filter */}
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Search models..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() => setFilterFree(!filterFree)}
                    className={`px-3 py-2 text-sm rounded-lg transition ${
                      filterFree
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Free Only
                  </button>
                </div>

                <select
                  value={settings.model}
                  onChange={(e) => handleChange('model', e.target.value)}
                  disabled={loadingModels}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  size="8"
                >
                  {loadingModels ? (
                    <option>Loading models...</option>
                  ) : (
                    models
                      .filter(model => {
                        // Apply free filter
                        if (filterFree && !model.isFree) return false;
                        // Apply search filter
                        if (searchQuery && !model.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                            !model.id.toLowerCase().includes(searchQuery.toLowerCase())) {
                          return false;
                        }
                        return true;
                      })
                      .map((model) => {
                        // Check if model name already contains "free" to avoid duplication
                        const nameLower = model.name.toLowerCase();
                        const alreadyHasFree = nameLower.includes('free');
                        const freeLabel = model.isFree && !alreadyHasFree ? ' (Free)' : '';

                        return (
                          <option key={model.id} value={model.id} className="text-gray-900 py-1">
                            {model.name}{freeLabel}
                          </option>
                        );
                      })
                  )}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {models.length} models available · Use search and filter to find models
                </p>
              </div>

              {/* Temperature */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Temperature: {settings.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.temperature}
                  onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Focused (0)</span>
                  <span>Balanced (1)</span>
                  <span>Creative (2)</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Higher values make output more random and creative. Lower values make it more focused and deterministic.
                </p>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Max Tokens: {settings.maxTokens}
                </label>
                <input
                  type="range"
                  min="100"
                  max="4000"
                  step="100"
                  value={settings.maxTokens}
                  onChange={(e) => handleChange('maxTokens', parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Short (100)</span>
                  <span>Medium (2000)</span>
                  <span>Long (4000)</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Maximum length of the response. ~4 characters per token.
                </p>
              </div>

              {/* Advanced Settings Toggle */}
              <details className="border-t pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-purple-600 transition">
                  Advanced Settings
                </summary>

                <div className="mt-4 space-y-4">
                  {/* Top P */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Top P: {settings.topP}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={settings.topP}
                      onChange={(e) => handleChange('topP', parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Controls diversity via nucleus sampling. 1.0 = no filtering.
                    </p>
                  </div>

                  {/* Frequency Penalty */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Frequency Penalty: {settings.frequencyPenalty}
                    </label>
                    <input
                      type="range"
                      min="-2"
                      max="2"
                      step="0.1"
                      value={settings.frequencyPenalty}
                      onChange={(e) => handleChange('frequencyPenalty', parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Reduces repetition. Positive values discourage repeated tokens.
                    </p>
                  </div>

                  {/* Presence Penalty */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Presence Penalty: {settings.presencePenalty}
                    </label>
                    <input
                      type="range"
                      min="-2"
                      max="2"
                      step="0.1"
                      value={settings.presencePenalty}
                      onChange={(e) => handleChange('presencePenalty', parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Encourages talking about new topics. Positive values increase likelihood of new topics.
                    </p>
                  </div>

                  {/* Context Window */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Context Window: {settings.contextWindow} tokens
                    </label>
                    <input
                      type="range"
                      min="1000"
                      max="200000"
                      step="1000"
                      value={settings.contextWindow}
                      onChange={(e) => handleChange('contextWindow', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1K</span>
                      <span>100K</span>
                      <span>200K</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Maximum conversation history to send. Older messages are dropped when limit is reached. Set based on your model's capabilities (e.g., 4K for most models, 128K+ for Claude/GPT-4).
                    </p>
                  </div>
                </div>
              </details>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={resetToDefaults}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Reset to Defaults
                </button>
                <div className="flex-1"></div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LLMSettings;
