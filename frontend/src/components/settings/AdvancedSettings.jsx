import { useState, useEffect } from 'react';
import SliderParameter from './SliderParameter';
import api from '../../services/api';

/**
 * Collapsible advanced settings section for LLM configuration
 */
const AdvancedSettings = ({ settings, updateSetting }) => {
  const isFeatherless = settings.provider === 'featherless';
  const isOpenRouter = settings.provider === 'openrouter';
  const [supportedParams, setSupportedParams] = useState([]);
  const [loadingParams, setLoadingParams] = useState(false);

  // Fetch supported parameters when model changes (for OpenRouter only)
  useEffect(() => {
    if (isOpenRouter && settings.model) {
      fetchSupportedParams(settings.model);
    } else {
      setSupportedParams([]);
    }
  }, [settings.model, settings.provider]);

  const fetchSupportedParams = async (modelId) => {
    try {
      setLoadingParams(true);
      const response = await api.get(`/users/model-parameters/${encodeURIComponent(modelId)}`);
      setSupportedParams(response.data.supported_parameters || []);
    } catch (err) {
      console.error('Failed to fetch model parameters:', err);
      setSupportedParams([]);
    } finally {
      setLoadingParams(false);
    }
  };

  // Check if a specific parameter is supported (for OpenRouter)
  const isParamSupported = (paramName) => supportedParams.includes(paramName);

  // Show extra params for Featherless OR for OpenRouter when supported
  const showTopK = isFeatherless || (isOpenRouter && isParamSupported('top_k'));
  const showRepetitionPenalty = isFeatherless || (isOpenRouter && isParamSupported('repetition_penalty'));
  const showMinP = isFeatherless || (isOpenRouter && isParamSupported('min_p'));
  const showExtraParams = showTopK || showRepetitionPenalty || showMinP;

  return (
    <details className="border-t pt-4">
      <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition">
        Advanced Settings
      </summary>

      <div className="mt-4 space-y-4">
        {/* Top P */}
        <SliderParameter
          label="Top P"
          value={settings.topP}
          min={0}
          max={1}
          step={0.05}
          onChange={(value) => updateSetting('topP', value)}
          description="Controls diversity via nucleus sampling. 1.0 = no filtering."
        />

        {/* Frequency Penalty */}
        <SliderParameter
          label="Frequency Penalty"
          value={settings.frequencyPenalty}
          min={-2}
          max={2}
          step={0.1}
          onChange={(value) => updateSetting('frequencyPenalty', value)}
          description="Reduces repetition. Positive values discourage repeated tokens."
        />

        {/* Presence Penalty */}
        <SliderParameter
          label="Presence Penalty"
          value={settings.presencePenalty}
          min={-2}
          max={2}
          step={0.1}
          onChange={(value) => updateSetting('presencePenalty', value)}
          description="Encourages talking about new topics. Positive values increase likelihood of new topics."
        />

        {/* Context Window */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Context Window
          </label>
          <input
            type="number"
            value={settings.contextWindow}
            onChange={(e) => updateSetting('contextWindow', parseInt(e.target.value) || 0)}
            min="1"
            className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
            placeholder="e.g., 4000, 8000, 128000"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Maximum conversation history to read. Older messages are dropped when limit is reached. Independent from Compaction system.
          </p>
        </div>

        {/* Extra sampling parameters (Featherless always, OpenRouter when model supports) */}
        {showExtraParams && (
          <>
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-3">
                {isFeatherless ? 'Featherless Parameters' : 'Extended Parameters'}
                {loadingParams && isOpenRouter && (
                  <span className="ml-2 text-gray-400">(checking model support...)</span>
                )}
              </p>
            </div>

            {/* Top K */}
            {showTopK && (
              <SliderParameter
                label="Top K"
                value={settings.topK ?? -1}
                min={-1}
                max={100}
                step={1}
                onChange={(value) => updateSetting('topK', value)}
                description="Limits number of top tokens considered. -1 = consider all tokens (disabled)."
              />
            )}

            {/* Repetition Penalty */}
            {showRepetitionPenalty && (
              <SliderParameter
                label="Repetition Penalty"
                value={settings.repetitionPenalty ?? 1.0}
                min={0}
                max={2}
                step={0.05}
                onChange={(value) => updateSetting('repetitionPenalty', value)}
                description="Penalizes repetition. 1.0 = no penalty, higher values reduce repetition."
              />
            )}

            {/* Min P */}
            {showMinP && (
              <SliderParameter
                label="Min P"
                value={settings.minP ?? 0.0}
                min={0}
                max={1}
                step={0.05}
                onChange={(value) => updateSetting('minP', value)}
                description="Minimum probability threshold. 0.0 = disabled. Filters out low-probability tokens."
              />
            )}
          </>
        )}
      </div>
    </details>
  );
};

export default AdvancedSettings;
