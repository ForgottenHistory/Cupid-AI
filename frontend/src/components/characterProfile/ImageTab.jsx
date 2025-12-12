import { useState, useEffect } from 'react';
import api from '../../services/api';
import characterService from '../../services/characterService';

const ImageTab = ({ character, onUpdate }) => {
  const [imageTags, setImageTags] = useState('');
  const [contextualTags, setContextualTags] = useState('');
  const [mainPromptOverride, setMainPromptOverride] = useState('');
  const [negativePromptOverride, setNegativePromptOverride] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [changingImage, setChangingImage] = useState(false);
  const [generatingPortrait, setGeneratingPortrait] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [additionalPrompt, setAdditionalPrompt] = useState('');

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
      console.log('📝 Contextual tags from backend:', response.data.contextual_tags);
      console.log('📝 Main prompt override from backend:', response.data.main_prompt_override);
      console.log('📝 Negative prompt override from backend:', response.data.negative_prompt_override);
      setImageTags(response.data.image_tags || '');
      setContextualTags(response.data.contextual_tags || '');
      setMainPromptOverride(response.data.main_prompt_override || '');
      setNegativePromptOverride(response.data.negative_prompt_override || '');
      setError(null);
    } catch (err) {
      // If 404 (character not synced to backend yet), try loading from local cardData
      if (err.response?.status === 404 && character.cardData?.data?.imageTags) {
        console.log('⚠️ Character not in backend (404), loading from cardData:', character.cardData.data.imageTags);
        setImageTags(character.cardData.data.imageTags);
        setContextualTags(character.cardData.data.contextualTags || '');
        setMainPromptOverride(character.cardData.data.mainPromptOverride || '');
        setNegativePromptOverride(character.cardData.data.negativePromptOverride || '');
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
      console.log(`💾 Saving contextual tags for character ${character.id}:`, contextualTags.trim());
      console.log(`💾 Saving main prompt override for character ${character.id}:`, mainPromptOverride.trim());
      console.log(`💾 Saving negative prompt override for character ${character.id}:`, negativePromptOverride.trim());

      // Save to backend
      const response = await api.put(`/characters/${character.id}/image-tags`, {
        image_tags: imageTags.trim() || null,
        contextual_tags: contextualTags.trim() || null,
        main_prompt_override: mainPromptOverride.trim() || null,
        negative_prompt_override: negativePromptOverride.trim() || null
      });
      console.log('✅ Tags and prompts saved to backend:', response.data);

      setSuccess('Tags saved successfully!');
      setTimeout(() => setSuccess(null), 3000);

      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('❌ Failed to save tags:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error || 'Failed to save tags');
    } finally {
      setSaving(false);
    }
  };

  const openPromptModal = () => {
    // Check if character has image tags configured
    if (!imageTags || imageTags.trim() === '') {
      setError('Please configure image tags first before generating a portrait');
      return;
    }

    setError(null);
    setSuccess(null);
    setAdditionalPrompt('');
    setShowPromptModal(true);
  };

  const generatePortrait = async () => {
    try {
      setShowPromptModal(false);
      setGeneratingPortrait(true);
      setError(null);
      setSuccess(null);

      console.log(`🎨 Generating portrait for character ${character.id} with tags:`, imageTags);
      if (additionalPrompt) {
        console.log(`🎨 Additional prompt:`, additionalPrompt);
      }

      // Call debug endpoint to generate image with "portrait" as context tag
      // Pass imageTags for unmatched characters (not yet synced to backend)
      const response = await api.post(`/debug/generate-image/${character.id}`, {
        contextTags: 'portrait',
        imageTags: imageTags, // Support both matched (backend) and unmatched (IndexedDB) characters
        additionalPrompt: additionalPrompt || undefined
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to generate portrait');
      }

      const base64Image = response.data.image; // Already includes data:image/png;base64, prefix
      console.log('✅ Portrait generated successfully');

      // Update character in backend
      const updates = {
        imageUrl: base64Image,
        cardData: {
          ...character.cardData,
          data: {
            ...character.cardData.data,
            image: base64Image
          }
        }
      };

      await characterService.updateCharacterData(character.id, updates);
      console.log('✅ Character portrait updated in backend');

      // Set preview
      setImagePreview(base64Image);

      // Show success
      setSuccess('Portrait generated successfully!');

      // Notify parent to refresh
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('❌ Failed to generate portrait:', err);
      setError(err.response?.data?.error || err.message || 'Failed to generate portrait');
    } finally {
      setGeneratingPortrait(false);
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

        try {
          // Update character in backend (update BOTH imageUrl and cardData.data.image)
          const updates = {
            imageUrl: base64Image, // Top-level property for display
            cardData: {
              ...character.cardData,
              data: {
                ...character.cardData.data,
                image: base64Image // Nested property for card data
              }
            }
          };

          await characterService.updateCharacterData(character.id, updates);
          console.log('✅ Character image updated in backend');

          // Set preview after successful save
          setImagePreview(base64Image);

          // Show success message
          setSuccess('Character image updated successfully!');
          setError(null);

          // Notify parent to refresh
          if (onUpdate) {
            onUpdate();
          }
        } catch (err) {
          console.error('❌ Failed to save image:', err);
          setError('Failed to save image');
        } finally {
          setChangingImage(false);
        }
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

          {/* Upload and Generate Buttons */}
          <div className="flex-1">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Change your character's portrait image. Upload a file or generate one using AI.
            </p>
            <div className="flex gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium rounded-xl cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={changingImage || generatingPortrait}
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
                    Upload Image
                  </>
                )}
              </label>

              <button
                onClick={openPromptModal}
                disabled={changingImage || generatingPortrait || !imageTags}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-xl transition-colors disabled:cursor-not-allowed"
              >
                {generatingPortrait ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Generate Portrait
                  </>
                )}
              </button>
            </div>
            {!imageTags && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                ⚠️ Configure image tags below before generating
              </p>
            )}
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

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Always Needed Tags Input */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Always Needed Tags (Character Appearance)
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          These tags are ALWAYS included in every generated image (e.g., hair color, eye color, body type)
        </p>
        <textarea
          value={imageTags}
          onChange={(e) => setImageTags(e.target.value)}
          placeholder="e.g., blue hair, red eyes, long hair, twin tails"
          rows={4}
          className="w-full px-4 py-3 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 font-mono text-sm"
        />
      </div>

      {/* Contextual Tags Input */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Contextual Tags (Character-Specific Options)
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          AI chooses from these tags based on conversation context (e.g., clothing, common poses, settings)
        </p>
        <textarea
          value={contextualTags}
          onChange={(e) => setContextualTags(e.target.value)}
          placeholder="e.g., smiling, casual clothes, bedroom, sitting, looking at viewer, school uniform"
          rows={4}
          className="w-full px-4 py-3 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 font-mono text-sm"
        />
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 dark:border-gray-700"></div>

      {/* Prompt Overrides Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Prompt Overrides (Optional)</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Override global prompt settings for this character only. Leave empty to use global defaults.
          </p>
        </div>

        {/* Main Prompt Override */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Main Prompt Override
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Replaces the global main prompt (default: "masterpiece, best quality, amazing quality, 1girl, solo")
          </p>
          <textarea
            value={mainPromptOverride}
            onChange={(e) => setMainPromptOverride(e.target.value)}
            placeholder="e.g., masterpiece, best quality, 1boy, solo, photorealistic"
            rows={3}
            className="w-full px-4 py-3 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 font-mono text-sm"
          />
        </div>

        {/* Negative Prompt Override */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Negative Prompt Override
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Replaces the global negative prompt (things to avoid in generated images)
          </p>
          <textarea
            value={negativePromptOverride}
            onChange={(e) => setNegativePromptOverride(e.target.value)}
            placeholder="e.g., lowres, bad anatomy, bad hands, text, error, cropped"
            rows={3}
            className="w-full px-4 py-3 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 font-mono text-sm"
          />
        </div>
      </div>

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
          'Save All Settings'
        )}
      </button>

      {/* Info Box */}
      <div className="bg-blue-50/50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200/30 dark:border-blue-800/30">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">ℹ️ How Image Generation Works:</p>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <p>1. <strong>Base prompt:</strong> "masterpiece, best quality, amazing quality, 1girl, solo"</p>
          <p>2. <strong>Always Needed Tags:</strong> Your character's appearance (forced into every image)</p>
          <p>3. <strong>AI-Chosen Tags:</strong> AI analyzes conversation and selects appropriate tags from:
            <span className="block ml-4 mt-1">• Global tag library (all valid Danbooru tags)</span>
            <span className="block ml-4">• Your contextual tags (character-specific options)</span>
          </p>
          <p className="text-xs italic mt-2">Final prompt = Base + Always Needed + AI-Chosen Tags</p>
          <p className="text-xs mt-2">🎯 The AI intelligently picks tags based on the last 10 messages</p>
        </div>
      </div>

      {/* Prompt Modal */}
      {showPromptModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Generate Portrait
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Add optional details to customize the portrait
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Additional Prompting (Optional)
                </label>
                <textarea
                  value={additionalPrompt}
                  onChange={(e) => setAdditionalPrompt(e.target.value)}
                  placeholder="e.g., sunset lighting, outdoor background, casual pose..."
                  rows={4}
                  className="w-full px-4 py-3 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 text-sm"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Leave empty to use default portrait settings
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={() => setShowPromptModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={generatePortrait}
                className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-medium rounded-xl transition-colors"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageTab;
