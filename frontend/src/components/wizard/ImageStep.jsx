import { useState } from 'react';
import api from '../../services/api';

const ImageStep = ({ character, updateCharacter }) => {
  const [generating, setGenerating] = useState(false);
  const [generatingAppearance, setGeneratingAppearance] = useState(false);
  const [error, setError] = useState('');

  const appearance = character.appearance || {};

  const updateAppearance = (field, value) => {
    updateCharacter('appearance', {
      ...appearance,
      [field]: value
    });
  };

  const handleGenerateAppearance = async () => {
    setGeneratingAppearance(true);
    setError('');

    try {
      const response = await api.post('/wizard/generate-appearance', {
        age: character.age,
        archetype: character.archetype,
        personalityTags: character.personalityTags
      });

      updateCharacter('appearance', response.data.appearance);
    } catch (err) {
      console.error('Failed to generate appearance:', err);
      setError(err.response?.data?.error || 'Failed to generate appearance. Please try again.');
    } finally {
      setGeneratingAppearance(false);
    }
  };

  const handleGenerateImage = async () => {
    setGenerating(true);
    setError('');

    try {
      const response = await api.post('/wizard/generate-image', {
        appearance: character.appearance,
        age: character.age,
        archetype: character.archetype,
        personalityTags: character.personalityTags
      });

      updateCharacter('imageBase64', response.data.imageBase64);
      updateCharacter('imageTags', response.data.imageTags);
    } catch (err) {
      console.error('Failed to generate image:', err);
      setError(err.response?.data?.error || 'Failed to generate image. Make sure Stable Diffusion is running.');
    } finally {
      setGenerating(false);
    }
  };

  const hasImage = character.imageBase64;

  return (
    <div className="space-y-6">
      {/* Appearance Selection */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Appearance</h3>
          <button
            type="button"
            onClick={handleGenerateAppearance}
            disabled={generatingAppearance}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingAppearance ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Generating...
              </span>
            ) : (
              'Generate Appearance'
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Hair Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hair Color
            </label>
            <select
              value={appearance.hairColor || ''}
              onChange={(e) => updateAppearance('hairColor', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
            >
              <option value="">Select...</option>
              <option value="Blonde">Blonde</option>
              <option value="Brunette">Brunette</option>
              <option value="Black">Black</option>
              <option value="Red">Red</option>
              <option value="Auburn">Auburn</option>
              <option value="Platinum">Platinum</option>
              <option value="Pink">Pink</option>
              <option value="Purple">Purple</option>
              <option value="Blue">Blue</option>
            </select>
          </div>

          {/* Hair Style */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hair Style
            </label>
            <select
              value={appearance.hairStyle || ''}
              onChange={(e) => updateAppearance('hairStyle', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
            >
              <option value="">Select...</option>
              <option value="Long Straight">Long Straight</option>
              <option value="Long Wavy">Long Wavy</option>
              <option value="Long Curly">Long Curly</option>
              <option value="Medium Length">Medium Length</option>
              <option value="Bob Cut">Bob Cut</option>
              <option value="Pixie Cut">Pixie Cut</option>
              <option value="Ponytail">Ponytail</option>
              <option value="Braided">Braided</option>
            </select>
          </div>

          {/* Eye Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Eye Color
            </label>
            <select
              value={appearance.eyeColor || ''}
              onChange={(e) => updateAppearance('eyeColor', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
            >
              <option value="">Select...</option>
              <option value="Brown">Brown</option>
              <option value="Blue">Blue</option>
              <option value="Green">Green</option>
              <option value="Hazel">Hazel</option>
              <option value="Gray">Gray</option>
              <option value="Amber">Amber</option>
              <option value="Violet">Violet</option>
            </select>
          </div>

          {/* Body Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Body Type
            </label>
            <select
              value={appearance.bodyType || ''}
              onChange={(e) => updateAppearance('bodyType', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
            >
              <option value="">Select...</option>
              <option value="Petite">Petite</option>
              <option value="Slim">Slim</option>
              <option value="Athletic">Athletic</option>
              <option value="Curvy">Curvy</option>
              <option value="Plus Size">Plus Size</option>
            </select>
          </div>

          {/* Style */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clothing Style
            </label>
            <select
              value={appearance.style || ''}
              onChange={(e) => updateAppearance('style', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
            >
              <option value="">Select...</option>
              <option value="Casual">Casual</option>
              <option value="Elegant">Elegant</option>
              <option value="Sporty">Sporty</option>
              <option value="Gothic">Gothic</option>
              <option value="Cute">Cute</option>
              <option value="Professional">Professional</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Generate Image Button */}
      {!hasImage && (
        <div className="text-center pt-4">
          <button
            onClick={handleGenerateImage}
            disabled={generating}
            className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg font-semibold shadow-lg"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                Generating Image...
              </span>
            ) : (
              'Generate Character Image'
            )}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            This may take 20-30 seconds
          </p>
        </div>
      )}

      {/* Generated Image */}
      {hasImage && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Generated Image</h3>
            <button
              onClick={handleGenerateImage}
              disabled={generating}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
            >
              {generating ? 'Regenerating...' : 'Regenerate'}
            </button>
          </div>

          <div className="flex justify-center">
            <img
              src={`data:image/png;base64,${character.imageBase64}`}
              alt="Generated character"
              className="max-w-md rounded-lg border-2 border-purple-500 shadow-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageStep;
