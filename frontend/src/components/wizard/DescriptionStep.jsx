import { useState } from 'react';
import api from '../../services/api';

const DescriptionStep = ({ character, updateCharacter }) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');

    try {
      const response = await api.post('/wizard/generate-description', {
        age: character.age,
        archetype: character.archetype,
        personalityTags: character.personalityTags
      });

      updateCharacter('name', response.data.name);
      updateCharacter('description', response.data.description);
    } catch (err) {
      console.error('Failed to generate description:', err);
      setError(err.response?.data?.error || 'Failed to generate description. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const hasDescription = character.description && character.description.trim().length > 0;
  const hasName = character.name && character.name.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          Click <strong>Generate Character</strong> to create a unique name and description based on your selections.
          The AI will create a detailed personality and background that guides how this character behaves in conversations.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Generate Button */}
      {!hasDescription && (
        <div className="text-center">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg font-semibold shadow-lg"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                Generating...
              </span>
            ) : (
              'Generate Character'
            )}
          </button>
        </div>
      )}

      {/* Generated Name and Description */}
      {hasDescription && (
        <div className="space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Character Name *
            </label>
            <input
              type="text"
              value={character.name || ''}
              onChange={(e) => updateCharacter('name', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
              placeholder="Character name"
            />
          </div>

          {/* Description Field */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-gray-700">
                Character Description
              </label>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
              >
                {generating ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>
            <textarea
              value={character.description}
              onChange={(e) => updateCharacter('description', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 font-mono text-sm"
              rows="12"
              placeholder="Character description will appear here..."
            />
            <p className="text-xs text-gray-500 mt-2">
              You can edit both the name and description directly if you want to make changes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DescriptionStep;
