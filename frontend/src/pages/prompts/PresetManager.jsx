import { useState } from 'react';

/**
 * Preset management UI component
 */
const PresetManager = ({
  presets,
  loadingPresets,
  saving,
  currentPreset,
  hasUnsavedChanges,
  onSave,
  onLoad,
  onDelete,
  onClearPreset
}) => {
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const handleSave = async () => {
    const success = await onSave(newPresetName);
    if (success) {
      setNewPresetName('');
      setShowSaveForm(false);
    }
  };

  return (
    <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Presets
          </h2>
          {/* Current Preset Indicator */}
          {currentPreset && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
                {currentPreset}
              </span>
              {hasUnsavedChanges && (
                <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded text-xs font-medium">
                  Modified
                </span>
              )}
              <button
                onClick={onClearPreset}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
                title="Clear preset tracking"
              >
                ×
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowSaveForm(!showSaveForm)}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition text-sm"
        >
          {showSaveForm ? 'Cancel' : 'Save as Preset'}
        </button>
      </div>

      {/* Save New Preset Form */}
      {showSaveForm && (
        <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Enter preset name..."
              className="flex-1 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button
              onClick={handleSave}
              disabled={saving || !newPresetName.trim()}
              className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            This will save your current prompts as a preset that you can load later.
          </p>
        </div>
      )}

      {/* Presets List */}
      {loadingPresets ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">Loading presets...</p>
      ) : presets.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No presets saved yet. Click "Save as Preset" to save your current prompts.
        </p>
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => {
            const isActive = currentPreset === preset.name;
            return (
              <div
                key={preset.name}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  isActive
                    ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
                    : 'bg-gray-50 dark:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isActive && (
                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  )}
                  <span className={`font-medium ${
                    isActive
                      ? 'text-purple-700 dark:text-purple-300'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {preset.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(preset.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onLoad(preset.name)}
                    disabled={saving}
                    className={`px-3 py-1 rounded text-sm font-medium disabled:opacity-50 transition ${
                      isActive
                        ? 'bg-purple-500 text-white hover:bg-purple-600'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {isActive ? 'Reload' : 'Load'}
                  </button>
                  <button
                    onClick={() => onDelete(preset.name)}
                    disabled={saving}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PresetManager;
