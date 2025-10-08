import SliderParameter from './SliderParameter';

/**
 * Collapsible advanced settings section for LLM configuration
 */
const AdvancedSettings = ({ settings, updateSetting }) => {
  return (
    <details className="border-t pt-4">
      <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-purple-600 transition">
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
        <SliderParameter
          label="Context Window"
          value={settings.contextWindow}
          min={1000}
          max={200000}
          step={1000}
          onChange={(value) => updateSetting('contextWindow', value)}
          labels={['1K', '100K', '200K']}
          description="Maximum conversation history to send. Older messages are dropped when limit is reached. Set based on your model's capabilities (e.g., 4K for most models, 128K+ for Claude/GPT-4)."
        />
      </div>
    </details>
  );
};

export default AdvancedSettings;
