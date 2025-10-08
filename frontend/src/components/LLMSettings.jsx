import { useState } from 'react';
import { useLLMSettings } from '../hooks/useLLMSettings';
import LLMSettingsForm from './settings/LLMSettingsForm';

const LLMSettings = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('content'); // 'content' or 'decision'

  // Hook for Content LLM settings
  const contentLLM = useLLMSettings('content');

  // Hook for Decision LLM settings
  const decisionLLM = useLLMSettings('decision');

  // Get current tab's settings
  const currentSettings = activeTab === 'content' ? contentLLM : decisionLLM;

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    currentSettings.saveSettings();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-pink-500 to-purple-600">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">LLM Settings</h2>
              <p className="text-white/80 text-sm mt-1">Configure AI models and parameters</p>
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
          <LLMSettingsForm
            type={activeTab}
            settings={currentSettings.settings}
            loading={currentSettings.loading}
            saving={currentSettings.saving}
            error={currentSettings.error}
            success={currentSettings.success}
            updateSetting={currentSettings.updateSetting}
            onSubmit={handleSubmit}
            onReset={currentSettings.resetToDefaults}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
};

export default LLMSettings;
