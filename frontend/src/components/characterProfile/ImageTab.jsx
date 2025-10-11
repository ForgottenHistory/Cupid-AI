import { useState, useEffect } from 'react';
import api from '../../services/api';

const ImageTab = ({ character, onUpdate }) => {
  const [imageTags, setImageTags] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500 dark:text-gray-400">Loading image tags...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p>Configure Danbooru-style tags for AI-generated character images.</p>
        <p className="mt-2">The AI will occasionally send generated images based on conversation context and character personality.</p>
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
