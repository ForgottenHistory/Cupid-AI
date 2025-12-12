import { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Model selector with search and filter capabilities
 */
const ModelSelector = ({ selectedModel, onChange, provider = 'openrouter' }) => {
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [filterFree, setFilterFree] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadModels();
  }, [provider]);

  const loadModels = async () => {
    try {
      setLoadingModels(true);

      // Determine API endpoint based on provider
      let apiUrl;
      switch (provider) {
        case 'featherless':
          apiUrl = 'https://api.featherless.ai/v1/models';
          break;
        case 'nanogpt':
          apiUrl = 'https://nano-gpt.com/api/v1/models';
          break;
        default:
          apiUrl = 'https://openrouter.ai/api/v1/models';
      }

      const response = await axios.get(apiUrl);

      // Parse models based on provider format
      let modelData;
      if (provider === 'featherless') {
        // Featherless format: { data: [ { id, name, model_class, context_length, ... } ] }
        modelData = response.data.data.map(model => ({
          id: model.id,
          name: model.name || model.id,
          context_length: model.context_length,
          isFree: false // Featherless doesn't expose free/paid info in API
        }));
      } else if (provider === 'nanogpt') {
        // NanoGPT format: { data: [ { id, name, context_length, ... } ] }
        // Similar to OpenRouter format
        modelData = response.data.data.map(model => ({
          id: model.id,
          name: model.name || model.id,
          context_length: model.context_length,
          isFree: false // NanoGPT is pay-per-prompt
        }));
      } else {
        // OpenRouter format: { data: [ { id, name, pricing, ... } ] }
        modelData = response.data.data.map(model => ({
          id: model.id,
          name: model.name,
          pricing: model.pricing,
          context_length: model.context_length,
          isFree: model.pricing?.prompt === '0' || model.id.includes(':free')
        }));
      }

      // Deduplicate models by ID (some providers return duplicates)
      const uniqueModels = Array.from(
        new Map(modelData.map(model => [model.id, model])).values()
      );

      setModels(uniqueModels);
    } catch (err) {
      console.error(`Failed to load ${provider} models:`, err);
      // Fallback to a basic list if API fails
      let fallbackModels;
      switch (provider) {
        case 'featherless':
          fallbackModels = [
            { id: 'GalrionSoftworks/Margnum-12B-v1', name: 'Margnum 12B v1', isFree: false },
          ];
          break;
        case 'nanogpt':
          fallbackModels = [
            { id: 'chatgpt-4o-latest', name: 'ChatGPT-4o Latest', isFree: false },
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', isFree: false },
          ];
          break;
        default:
          fallbackModels = [
            { id: 'deepseek/deepseek-chat-v3', name: 'DeepSeek Chat v3', isFree: true },
            { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', isFree: true },
          ];
      }
      setModels(fallbackModels);
    } finally {
      setLoadingModels(false);
    }
  };

  const filteredModels = models.filter(model => {
    // Apply free filter
    if (filterFree && !model.isFree) return false;
    // Apply search filter
    if (searchQuery && !model.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !model.id.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const selectedModelData = models.find(m => m.id === selectedModel);

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Model
      </label>

      {/* Current Selection Display */}
      {!loadingModels && models.length > 0 && selectedModelData && (
        <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg">
          <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">
            Currently Selected
          </div>
          <div className="font-medium text-gray-900 dark:text-gray-100">
            {selectedModelData.name}
          </div>
          {selectedModelData.isFree && (
            <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-medium rounded">
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
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
        />
        <button
          type="button"
          onClick={() => setFilterFree(!filterFree)}
          className={`px-3 py-2 text-sm rounded-lg transition ${
            filterFree
              ? 'bg-purple-500 dark:bg-purple-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Free Only
        </button>
      </div>

      {/* Model Dropdown */}
      <select
        value={selectedModel}
        onChange={(e) => {
          console.log('ModelSelector onChange:', e.target.value);
          onChange(e.target.value);
        }}
        onClick={(e) => {
          // Force onChange even if clicking the same option
          if (e.target.tagName === 'OPTION') {
            const clickedValue = e.target.value;
            if (clickedValue && clickedValue !== selectedModel) {
              onChange(clickedValue);
            }
          }
        }}
        disabled={loadingModels}
        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        size="8"
      >
        {loadingModels ? (
          <option>Loading models...</option>
        ) : (
          filteredModels.map((model) => {
            // Check if model name already contains "free" to avoid duplication
            const nameLower = model.name.toLowerCase();
            const alreadyHasFree = nameLower.includes('free');
            const freeLabel = model.isFree && !alreadyHasFree ? ' (Free)' : '';

            return (
              <option key={model.id} value={model.id} className="text-gray-900 dark:text-gray-100 py-1">
                {model.name}{freeLabel}
              </option>
            );
          })
        )}
      </select>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {filteredModels.length} models available · Use search and filter to find models
      </p>
    </div>
  );
};

export default ModelSelector;
