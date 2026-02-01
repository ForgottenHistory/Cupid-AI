import { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Random model pool selector - allows adding multiple models that get randomly picked per AI call
 */
const RandomModelPool = ({ randomModels = [], provider = 'openrouter', onChange }) => {
  const [enabled, setEnabled] = useState(randomModels.length > 0);
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSelector, setShowSelector] = useState(false);
  const [filterFree, setFilterFree] = useState(false);

  useEffect(() => {
    if (enabled) {
      loadModels();
    }
  }, [provider, enabled]);

  // Sync enabled state when randomModels changes externally (e.g. loading from server)
  useEffect(() => {
    setEnabled(randomModels.length > 0);
  }, [randomModels]);

  const loadModels = async () => {
    try {
      setLoadingModels(true);

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

      let modelData;
      if (provider === 'featherless') {
        modelData = response.data.data.map(model => ({
          id: model.id,
          name: model.name || model.id,
          isFree: false
        }));
      } else if (provider === 'nanogpt') {
        modelData = response.data.data.map(model => ({
          id: model.id,
          name: model.name || model.id,
          isFree: false
        }));
      } else {
        modelData = response.data.data.map(model => ({
          id: model.id,
          name: model.name,
          isFree: model.pricing?.prompt === '0' || model.id.includes(':free')
        }));
      }

      const uniqueModels = Array.from(
        new Map(modelData.map(model => [model.id, model])).values()
      );

      setModels(uniqueModels);
    } catch (err) {
      console.error(`Failed to load ${provider} models for random pool:`, err);
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleToggle = () => {
    if (enabled) {
      // Disabling - clear the pool
      setEnabled(false);
      setShowSelector(false);
      onChange([]);
    } else {
      setEnabled(true);
    }
  };

  const addModel = (modelId) => {
    if (!randomModels.includes(modelId)) {
      onChange([...randomModels, modelId]);
    }
    setShowSelector(false);
    setSearchQuery('');
  };

  const removeModel = (modelId) => {
    const updated = randomModels.filter(m => m !== modelId);
    onChange(updated);
    if (updated.length === 0) {
      setEnabled(false);
    }
  };

  const clearAll = () => {
    onChange([]);
    setEnabled(false);
  };

  const getModelName = (modelId) => {
    const found = models.find(m => m.id === modelId);
    return found ? found.name : modelId;
  };

  const filteredModels = models.filter(model => {
    // Exclude already added models
    if (randomModels.includes(model.id)) return false;
    if (filterFree && !model.isFree) return false;
    if (searchQuery && !model.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !model.id.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
          Random Model Pool
        </label>
        <button
          type="button"
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        When enabled, a random model from the pool is picked for each AI call instead of the primary model.
      </p>

      {enabled && (
        <div className="space-y-3">
          {/* Current pool */}
          {randomModels.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {randomModels.length} model{randomModels.length !== 1 ? 's' : ''} in pool
                </span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {randomModels.map(modelId => (
                  <span
                    key={modelId}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 text-xs font-medium rounded-full border border-purple-200 dark:border-purple-700"
                  >
                    {getModelName(modelId)}
                    <button
                      type="button"
                      onClick={() => removeModel(modelId)}
                      className="ml-0.5 text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-200"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Add model button / selector */}
          {!showSelector ? (
            <button
              type="button"
              onClick={() => setShowSelector(true)}
              className="w-full px-3 py-2 text-sm border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-purple-400 hover:text-purple-500 dark:hover:border-purple-500 dark:hover:text-purple-400 transition"
            >
              + Add Model to Pool
            </button>
          ) : (
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                />
                <button
                  type="button"
                  onClick={() => setFilterFree(!filterFree)}
                  className={`px-2.5 py-1.5 text-xs rounded-lg transition ${
                    filterFree
                      ? 'bg-purple-500 dark:bg-purple-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Free
                </button>
                <button
                  type="button"
                  onClick={() => { setShowSelector(false); setSearchQuery(''); }}
                  className="px-2.5 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
              <select
                onChange={(e) => { if (e.target.value) addModel(e.target.value); }}
                disabled={loadingModels}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 disabled:opacity-50"
                size="6"
                value=""
              >
                {loadingModels ? (
                  <option>Loading models...</option>
                ) : (
                  filteredModels.map(model => {
                    const nameLower = model.name.toLowerCase();
                    const alreadyHasFree = nameLower.includes('free');
                    const freeLabel = model.isFree && !alreadyHasFree ? ' (Free)' : '';
                    return (
                      <option key={model.id} value={model.id} className="py-1">
                        {model.name}{freeLabel}
                      </option>
                    );
                  })
                )}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {filteredModels.length} models available - click to add
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RandomModelPool;
