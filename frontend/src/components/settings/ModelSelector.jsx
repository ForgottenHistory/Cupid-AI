import { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Model selector with search and filter capabilities
 */
const ModelSelector = ({ selectedModel, onChange }) => {
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [filterFree, setFilterFree] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoadingModels(true);
      const response = await axios.get('https://openrouter.ai/api/v1/models');
      const modelData = response.data.data.map(model => ({
        id: model.id,
        name: model.name,
        pricing: model.pricing,
        context_length: model.context_length,
        isFree: model.pricing?.prompt === '0' || model.id.includes(':free')
      }));
      setModels(modelData);
    } catch (err) {
      console.error('Failed to load models:', err);
      // Fallback to a basic list if API fails
      setModels([
        { id: 'deepseek/deepseek-chat-v3', name: 'DeepSeek Chat v3', isFree: true },
        { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', isFree: true },
      ]);
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
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Model
      </label>

      {/* Current Selection Display */}
      {!loadingModels && models.length > 0 && selectedModelData && (
        <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">
            Currently Selected
          </div>
          <div className="font-medium text-gray-900">
            {selectedModelData.name}
          </div>
          {selectedModelData.isFree && (
            <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
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
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
        />
        <button
          type="button"
          onClick={() => setFilterFree(!filterFree)}
          className={`px-3 py-2 text-sm rounded-lg transition ${
            filterFree
              ? 'bg-purple-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Free Only
        </button>
      </div>

      {/* Model Dropdown */}
      <select
        value={selectedModel}
        onChange={(e) => onChange(e.target.value)}
        disabled={loadingModels}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
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
              <option key={model.id} value={model.id} className="text-gray-900 py-1">
                {model.name}{freeLabel}
              </option>
            );
          })
        )}
      </select>

      <p className="text-xs text-gray-500 mt-1">
        {filteredModels.length} models available · Use search and filter to find models
      </p>
    </div>
  );
};

export default ModelSelector;
