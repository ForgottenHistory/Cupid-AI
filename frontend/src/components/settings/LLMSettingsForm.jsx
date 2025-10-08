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
        <p className="text-gray-600">Loading settings...</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="p-6 space-y-6">
      {/* Tab Description */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
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

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition"
        >
          Reset to Defaults
        </button>
        <div className="flex-1"></div>
        <button
          type="button"
          onClick={onCancel}
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
  );
};

export default LLMSettingsForm;
