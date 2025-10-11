import { useState, useEffect } from 'react';
import api from '../../services/api';
import characterService from '../../services/characterService';

const ImageTab = ({ character, onUpdate }) => {
  const [imageTags, setImageTags] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [changingImage, setChangingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  // Load character's image tags from backend
  useEffect(() => {
    loadImageTags();
  }, [character.id]);

  const loadImageTags = async () => {
    try {
      setLoading(true);
      console.log(`📥 Loading image tags for character ${character.id}`);
      // Try to load from backend first
      const response = await api.get(`/characters/${character.id}`);
      console.log('✅ Backend response:', response.data);
      console.log('📝 Image tags from backend:', response.data.image_tags);
      setImageTags(response.data.image_tags || '');
      setError(null);
    } catch (err) {
      // If 404 (character not synced to backend yet), try loading from local cardData
      if (err.response?.status === 404 && character.cardData?.data?.imageTags) {
        console.log('⚠️ Character not in backend (404), loading from cardData:', character.cardData.data.imageTags);
        setImageTags(character.cardData.data.imageTags);
        setError(null);
      } else {
        console.error('❌ Failed to load image tags:', err);
        setError('Failed to load image tags');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      console.log(`💾 Saving image tags for character ${character.id}:`, imageTags.trim());
      const response = await api.put(`/characters/${character.id}/image-tags`, {
        image_tags: imageTags.trim() || null
      });
      console.log('✅ Save response:', response.data);

      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('❌ Failed to save image tags:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error || 'Failed to save image tags');
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }

    try {
      setChangingImage(true);
      setError(null);

      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Image = event.target.result;
        setImagePreview(base64Image);

        // Update character in IndexedDB
        const updates = {
          cardData: {
            ...character.cardData,
            data: {
              ...character.cardData.data,
              image: base64Image
            }
          }
        };

        await characterService.updateCharacterData(character.id, updates);
        console.log('✅ Character image updated in IndexedDB');

        // Trigger re-sync to backend (if character is already synced)
        try {
          await api.get(`/characters/${character.id}`);
          // Character exists in backend, sync the new image
          await api.post('/sync/characters', {
            characters: [await characterService.getCharacter(character.id)]
          });
          console.log('✅ Character image synced to backend');
        } catch (err) {
          if (err.response?.status !== 404) {
            console.warn('⚠️ Failed to sync image to backend:', err);
          }
        }

        // Notify parent to refresh
        if (onUpdate) {
          onUpdate();
        }

        setChangingImage(false);
      };

      reader.onerror = () => {
        setError('Failed to read image file');
        setChangingImage(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('❌ Failed to change image:', err);
      setError('Failed to change image');
      setChangingImage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500 dark:text-gray-400">Loading image tags...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Character Portrait Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Character Portrait</h3>
        </div>

        <div className="flex items-start gap-4">
          {/* Current Image Preview */}
          <div className="flex-shrink-0">
            <div className="w-32 h-32 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600">
              <img
                src={imagePreview || character.imageUrl || character.cardData?.data?.image}
                alt={character.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Upload Button */}
          <div className="flex-1">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Change your character's portrait image. Supports JPG, PNG, WebP (max 5MB).
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium rounded-xl cursor-pointer transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={changingImage}
                className="hidden"
              />
              {changingImage ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Choose New Image
                </>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 dark:border-gray-700"></div>

      {/* AI-Generated Images Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI-Generated Images</h3>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p>Configure Danbooru-style tags for AI-generated character images.</p>
          <p className="mt-2">The AI will occasionally send generated images based on conversation context and character personality.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Image Tags Input */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Character Image Tags (Danbooru Format)
        </label>
        <textarea
          value={imageTags}
          onChange={(e) => setImageTags(e.target.value)}
          placeholder="e.g., blue hair, red eyes, long hair, school uniform, white shirt, blue skirt"
          rows={8}
          className="w-full px-4 py-3 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 font-mono text-sm"
        />

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </>
          ) : (
            'Save Image Tags'
          )}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50/50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200/30 dark:border-blue-800/30">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">ℹ️ How it Works:</p>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <p>1. <strong>Base prompt:</strong> "masterpiece, best quality, amazing quality, 1girl, solo"</p>
          <p>2. <strong>Character tags:</strong> Your tags from above</p>
          <p>3. <strong>Context tags:</strong> AI generates tags based on situation (e.g., "smiling, waving, park, daytime")</p>
          <p className="text-xs italic mt-2">Final prompt = Base + Character + Context</p>
        </div>
      </div>
    </div>
  );
};

export default ImageTab;
