import ModelSelector from './ModelSelector';
import SliderParameter from './SliderParameter';
import AdvancedSettings from './AdvancedSettings';

/**
 * Reusable LLM settings form for Content or Decision LLM
 */
const LLMSettingsForm = ({
  type,
  settings,
  loading,
  saving,
  error,
  success,
  updateSetting,
  onSubmit,
  onReset,
  onCancel
}) => {
  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading settings...</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="p-6 space-y-6">
        {/* Tab Description */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
          <p className="text-sm text-blue-900 dark:text-blue-300">
            {type === 'content' ? (
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
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg text-green-700 dark:text-green-300 text-sm">
            {success}
          </div>
        )}

        {/* Model Selection */}
        <ModelSelector
          selectedModel={settings.model}
          onChange={(value) => updateSetting('model', value)}
        />

        {/* Temperature */}
        <SliderParameter
          label="Temperature"
          value={settings.temperature}
          min={0}
          max={2}
          step={0.1}
          onChange={(value) => updateSetting('temperature', value)}
          labels={['Focused (0)', 'Balanced (1)', 'Creative (2)']}
          description="Higher values make output more random and creative. Lower values make it more focused and deterministic."
        />

        {/* Max Tokens */}
        <SliderParameter
          label="Max Tokens"
          value={settings.maxTokens}
          min={100}
          max={4000}
          step={100}
          onChange={(value) => updateSetting('maxTokens', value)}
          labels={['Short (100)', 'Medium (2000)', 'Long (4000)']}
          description="Maximum length of the response. ~4 characters per token."
        />

        {/* Advanced Settings */}
        <AdvancedSettings
          settings={settings}
          updateSetting={updateSetting}
        />
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition font-medium"
        >
          Reset to Defaults
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 dark:from-pink-600 dark:to-purple-700 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 dark:hover:from-pink-700 dark:hover:to-purple-800 transition font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default LLMSettingsForm;
