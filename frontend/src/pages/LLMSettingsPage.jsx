import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLLMSettings } from '../hooks/useLLMSettings';
import LLMSettingsForm from '../components/settings/LLMSettingsForm';

const LLMSettingsPage = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [activeTab, setActiveTab] = useState('content'); // 'content', 'decision', 'imagetag', or 'metadata'

  // Hook for Content LLM settings
  const contentLLM = useLLMSettings('content');

  // Hook for Decision LLM settings
  const decisionLLM = useLLMSettings('decision');

  // Hook for Image Tag LLM settings
  const imagetagLLM = useLLMSettings('imagetag');

  // Hook for Metadata LLM settings
  const metadataLLM = useLLMSettings('metadata');

  // Get current tab's settings
  const currentSettings = activeTab === 'content' ? contentLLM : activeTab === 'decision' ? decisionLLM : activeTab === 'imagetag' ? imagetagLLM : metadataLLM;

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    await currentSettings.saveSettings();
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div ref={containerRef} className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-2 mb-4 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">LLM Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Configure AI models and parameters</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-t-xl">
          <button
            onClick={() => setActiveTab('content')}
            className={`flex-1 px-6 py-3 font-semibold transition ${
              activeTab === 'content'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 bg-white dark:bg-gray-800'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Chat LLM
          </button>
          <button
            onClick={() => setActiveTab('decision')}
            className={`flex-1 px-6 py-3 font-semibold transition ${
              activeTab === 'decision'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 bg-white dark:bg-gray-800'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Decision LLM
          </button>
          <button
            onClick={() => setActiveTab('imagetag')}
            className={`flex-1 px-6 py-3 font-semibold transition ${
              activeTab === 'imagetag'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 bg-white dark:bg-gray-800'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Image Tag LLM
          </button>
          <button
            onClick={() => setActiveTab('metadata')}
            className={`flex-1 px-6 py-3 font-semibold transition ${
              activeTab === 'metadata'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 bg-white dark:bg-gray-800'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Metadata LLM
          </button>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-b-xl shadow-lg">
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
            onCancel={() => navigate('/')}
          />
        </div>
      </div>
    </div>
  );
};

export default LLMSettingsPage;
