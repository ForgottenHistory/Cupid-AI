import SliderParameter from './SliderParameter';

/**
 * Collapsible advanced settings section for LLM configuration
 */
const AdvancedSettings = ({ settings, updateSetting }) => {
  const isFeatherless = settings.provider === 'featherless';

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

        {/* Featherless-specific parameters */}
        {isFeatherless && (
          <>
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-3">
                Featherless-Only Parameters
              </p>
            </div>

            {/* Top K */}
            <SliderParameter
              label="Top K"
              value={settings.topK ?? -1}
              min={-1}
              max={100}
              step={1}
              onChange={(value) => updateSetting('topK', value)}
              description="Limits number of top tokens considered. -1 = consider all tokens (disabled)."
            />

            {/* Repetition Penalty */}
            <SliderParameter
              label="Repetition Penalty"
              value={settings.repetitionPenalty ?? 1.0}
              min={0}
              max={2}
              step={0.05}
              onChange={(value) => updateSetting('repetitionPenalty', value)}
              description="Penalizes repetition. 1.0 = no penalty, higher values reduce repetition."
            />

            {/* Min P */}
            <SliderParameter
              label="Min P"
              value={settings.minP ?? 0.0}
              min={0}
              max={1}
              step={0.05}
              onChange={(value) => updateSetting('minP', value)}
              description="Minimum probability threshold. 0.0 = disabled. Filters out low-probability tokens."
            />
          </>
        )}
      </div>
    </details>
  );
};

export default AdvancedSettings;
