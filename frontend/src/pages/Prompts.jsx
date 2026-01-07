import { useRef, useCallback } from 'react';
import {
  usePrompts,
  PromptSection,
  PresetManager,
  conversationPromptFields,
  decisionEnginePromptFields,
  characterGenerationPromptFields,
  wizardPromptFields
} from './prompts/index';

const Prompts = () => {
  const containerRef = useRef(null);
  const {
    prompts,
    loading,
    saving,
    message,
    hasUnsavedChanges,
    loadPrompts,
    savePrompts,
    resetPrompts,
    updatePrompt,
    presets,
    loadingPresets,
    currentPreset,
    savePreset,
    loadPreset,
    deletePreset,
    clearCurrentPreset
  } = usePrompts(containerRef);

  const fileInputRef = useRef(null);

  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify(prompts, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cupid-prompts-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [prompts]);

  const handleImport = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (typeof imported !== 'object' || imported === null) {
          alert('Invalid prompts file format');
          return;
        }
        // Update each prompt key that exists in the imported file
        Object.keys(imported).forEach(key => {
          if (typeof imported[key] === 'string') {
            updatePrompt(key, imported[key]);
          }
        });
        alert('Prompts imported successfully! Remember to save your changes.');
      } catch (err) {
        alert('Failed to parse prompts file: ' + err.message);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be imported again
    event.target.value = '';
  }, [updatePrompt]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading prompts...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto custom-scrollbar bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-5xl mx-auto px-8 py-12 pb-24">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            AI Behavior Prompts
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure how AI characters behave, respond, and communicate
          </p>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-6 flex gap-3 flex-wrap">
          <button
            onClick={savePrompts}
            disabled={saving}
            className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-medium hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            onClick={loadPrompts}
            disabled={loading || saving}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Reload
          </button>
          <button
            onClick={resetPrompts}
            disabled={saving}
            className="px-6 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Reset to Defaults
          </button>
          <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1"></div>
          <button
            onClick={handleExport}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition"
          >
            Export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition"
          >
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>

        {/* Presets */}
        <PresetManager
          presets={presets}
          loadingPresets={loadingPresets}
          saving={saving}
          currentPreset={currentPreset}
          hasUnsavedChanges={hasUnsavedChanges}
          onSave={savePreset}
          onLoad={loadPreset}
          onDelete={deletePreset}
          onClearPreset={clearCurrentPreset}
        />

        {/* Conversation Behavior Prompts */}
        <PromptSection
          title="Conversation Behavior"
          fields={conversationPromptFields}
          prompts={prompts}
          updatePrompt={updatePrompt}
          showTotalTokens
        />

        {/* Separator */}
        <div className="my-12 border-t-2 border-purple-200 dark:border-purple-800"></div>

        {/* Decision Engine Prompts */}
        <PromptSection
          title="Decision Engine"
          description="AI prompts for character decision-making. These control reactions, moods, unmatch decisions, and proactive messaging behavior."
          fields={decisionEnginePromptFields}
          prompts={prompts}
          updatePrompt={updatePrompt}
          showTokens
        />

        {/* Separator */}
        <div className="my-12 border-t-2 border-purple-200 dark:border-purple-800"></div>

        {/* Character Generation Prompts */}
        <PromptSection
          title="Character Generation & Dating Profile"
          description="AI prompts for generating character profiles, schedules, and personality traits. Use placeholder variables like {characterName} and {description} where needed."
          fields={characterGenerationPromptFields}
          prompts={prompts}
          updatePrompt={updatePrompt}
          showTokens
        />

        {/* Separator */}
        <div className="my-12 border-t-2 border-purple-200 dark:border-purple-800"></div>

        {/* Character Wizard Prompts */}
        <PromptSection
          title="Character Wizard"
          description="AI prompts used by the Character Wizard to generate new characters. These control name/description generation, appearance suggestions, and profile image tags."
          fields={wizardPromptFields}
          prompts={prompts}
          updatePrompt={updatePrompt}
          showTokens
        />

        {/* Bottom Save Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={savePrompts}
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-medium hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Prompts;
