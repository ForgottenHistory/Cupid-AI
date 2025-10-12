import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

/**
 * Tags & Image Generation Settings Page
 * Tabs for: Danbooru Tag Library + Image Tag Prompts
 */
const TagLibrary = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('tags'); // 'tags' or 'prompts'

  // Tag Library state
  const [tagContent, setTagContent] = useState('');
  const [tagLoading, setTagLoading] = useState(true);
  const [tagSaving, setTagSaving] = useState(false);
  const [tagMessage, setTagMessage] = useState(null);
  const [selectedText, setSelectedText] = useState('');

  // Image Tag Prompts state
  const [prompts, setPrompts] = useState({
    systemPrompt: '',
    guidelinesPrompt: '',
    scalePrompt: '',
    contextAnalysisPrompt: '',
    boldnessPrompt: '',
    closingInstructionsPrompt: '',
    visualConsistencyPrompt: '',
    exampleOutputPrompt: ''
  });
  const [promptsLoading, setPromptsLoading] = useState(true);
  const [promptsSaving, setPromptsSaving] = useState(false);
  const [promptsMessage, setPromptsMessage] = useState(null);

  // Load both on mount
  useEffect(() => {
    loadTagLibrary();
    loadImageTagPrompts();
  }, []);

  // ========== TAG LIBRARY FUNCTIONS ==========

  const loadTagLibrary = async () => {
    try {
      setTagLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:3000/api/tag-library', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTagContent(response.data.content);
      setTagMessage(null);
    } catch (error) {
      console.error('Failed to load tag library:', error);
      setTagMessage({ type: 'error', text: 'Failed to load tag library' });
    } finally {
      setTagLoading(false);
    }
  };

  const saveTagLibrary = async () => {
    try {
      setTagSaving(true);
      const token = localStorage.getItem('token');
      await axios.put('http://localhost:3000/api/tag-library',
        { content: tagContent },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setTagMessage({ type: 'success', text: 'Tag library saved successfully!' });
      setTimeout(() => setTagMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save tag library:', error);
      setTagMessage({ type: 'error', text: 'Failed to save tag library' });
    } finally {
      setTagSaving(false);
    }
  };

  // Formatting utilities
  const formatToCommaSeparated = () => {
    if (!selectedText) {
      setTagMessage({ type: 'error', text: 'Please select text to format' });
      return;
    }

    const formatted = selectedText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))
      .join(', ');

    const textarea = document.getElementById('tag-editor');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = tagContent.substring(0, start) + formatted + tagContent.substring(end);
    setTagContent(newContent);
    setTagMessage({ type: 'success', text: 'Formatted to comma-separated' });
    setTimeout(() => setTagMessage(null), 2000);
  };

  const convertToLowercase = () => {
    if (!selectedText) {
      setTagMessage({ type: 'error', text: 'Please select text to convert' });
      return;
    }

    const textarea = document.getElementById('tag-editor');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = tagContent.substring(0, start) + selectedText.toLowerCase() + tagContent.substring(end);
    setTagContent(newContent);
    setTagMessage({ type: 'success', text: 'Converted to lowercase' });
    setTimeout(() => setTagMessage(null), 2000);
  };

  const removeDuplicates = () => {
    if (!selectedText) {
      setTagMessage({ type: 'error', text: 'Please select comma-separated tags to deduplicate' });
      return;
    }

    const tags = selectedText
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    const unique = [...new Set(tags)];
    const formatted = unique.join(', ');

    const textarea = document.getElementById('tag-editor');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = tagContent.substring(0, start) + formatted + tagContent.substring(end);
    setTagContent(newContent);
    setTagMessage({ type: 'success', text: `Removed ${tags.length - unique.length} duplicates` });
    setTimeout(() => setTagMessage(null), 2000);
  };

  const sortAlphabetically = () => {
    if (!selectedText) {
      setTagMessage({ type: 'error', text: 'Please select comma-separated tags to sort' });
      return;
    }

    const sorted = selectedText
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .sort()
      .join(', ');

    const textarea = document.getElementById('tag-editor');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = tagContent.substring(0, start) + sorted + tagContent.substring(end);
    setTagContent(newContent);
    setTagMessage({ type: 'success', text: 'Sorted alphabetically' });
    setTimeout(() => setTagMessage(null), 2000);
  };

  const handleTextSelection = () => {
    const textarea = document.getElementById('tag-editor');
    const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    setSelectedText(selected);
  };

  // ========== IMAGE TAG PROMPTS FUNCTIONS ==========

  const loadImageTagPrompts = async () => {
    try {
      setPromptsLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:3000/api/image-tag-prompts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrompts(response.data);
      setPromptsMessage(null);
    } catch (error) {
      console.error('Failed to load image tag prompts:', error);
      setPromptsMessage({ type: 'error', text: 'Failed to load image tag prompts' });
    } finally {
      setPromptsLoading(false);
    }
  };

  const saveImageTagPrompts = async () => {
    try {
      setPromptsSaving(true);
      const token = localStorage.getItem('token');
      await axios.put('http://localhost:3000/api/image-tag-prompts',
        { prompts },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setPromptsMessage({ type: 'success', text: 'Image tag prompts saved successfully!' });
      setTimeout(() => setPromptsMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save image tag prompts:', error);
      setPromptsMessage({ type: 'error', text: 'Failed to save image tag prompts' });
    } finally {
      setPromptsSaving(false);
    }
  };

  const resetImageTagPrompts = async () => {
    if (!confirm('Reset all image tag prompts to defaults? This cannot be undone.')) {
      return;
    }

    try {
      setPromptsSaving(true);
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:3000/api/image-tag-prompts/reset',
        {},
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setPrompts(response.data.prompts);
      setPromptsMessage({ type: 'success', text: 'Image tag prompts reset to defaults!' });
      setTimeout(() => setPromptsMessage(null), 3000);
    } catch (error) {
      console.error('Failed to reset image tag prompts:', error);
      setPromptsMessage({ type: 'error', text: 'Failed to reset image tag prompts' });
    } finally {
      setPromptsSaving(false);
    }
  };

  const updatePrompt = (key, value) => {
    setPrompts(prev => ({ ...prev, [key]: value }));
  };

  const promptFields = [
    { key: 'systemPrompt', label: 'System Prompt', description: 'Opening instruction for tag selection', rows: 2 },
    { key: 'guidelinesPrompt', label: 'Guidelines', description: 'Tag selection guidelines and clothing specificity rules', rows: 8 },
    { key: 'scalePrompt', label: 'Suggestiveness Scale', description: 'CASUAL/FLIRTY/SUGGESTIVE/NSFW scale with examples', rows: 12 },
    { key: 'contextAnalysisPrompt', label: 'Context Analysis', description: 'How to analyze conversation context', rows: 4 },
    { key: 'boldnessPrompt', label: 'Boldness Instructions', description: 'Instructions for bold/varied/spicy image selection', rows: 6 },
    { key: 'closingInstructionsPrompt', label: 'Closing Instructions', description: 'Final rules (only use library tags, no explanations, etc)', rows: 3 },
    { key: 'visualConsistencyPrompt', label: 'Visual Consistency', description: 'Instructions for maintaining consistency across multiple images', rows: 8 },
    { key: 'exampleOutputPrompt', label: 'Example Output', description: 'Example tag format', rows: 2 }
  ];

  // ========== RENDER ==========

  if (tagLoading && promptsLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Image Generation Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure Danbooru tag library and AI image generation prompts
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-4 border-b border-gray-300 dark:border-gray-600">
          <button
            onClick={() => setActiveTab('tags')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'tags'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Tag Library
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'prompts'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            AI Prompts
          </button>
        </div>

        {/* TAG LIBRARY TAB */}
        {activeTab === 'tags' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
            {/* Message */}
            {tagMessage && (
              <div className={`mb-6 p-4 rounded-lg ${
                tagMessage.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              }`}>
                {tagMessage.text}
              </div>
            )}

            {/* Formatting Tools */}
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                onClick={formatToCommaSeparated}
                className="px-5 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition text-sm font-medium shadow-md hover:shadow-lg"
                title="Convert selected lines to comma-separated format"
              >
                📝 Lines → Comma-separated
              </button>
              <button
                onClick={convertToLowercase}
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition text-sm font-medium shadow-md hover:shadow-lg"
                title="Convert selected text to lowercase"
              >
                🔡 Lowercase
              </button>
              <button
                onClick={removeDuplicates}
                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition text-sm font-medium shadow-md hover:shadow-lg"
                title="Remove duplicate tags from selected comma-separated list"
              >
                🗑️ Remove Duplicates
              </button>
              <button
                onClick={sortAlphabetically}
                className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition text-sm font-medium shadow-md hover:shadow-lg"
                title="Sort selected comma-separated tags alphabetically"
              >
                🔤 Sort A-Z
              </button>
            </div>

            {/* Editor */}
            <textarea
              id="tag-editor"
              value={tagContent}
              onChange={(e) => setTagContent(e.target.value)}
              onSelect={handleTextSelection}
              onMouseUp={handleTextSelection}
              onKeyUp={handleTextSelection}
              className="w-full h-[600px] p-5 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y"
              spellCheck={false}
            />

            {/* Action Buttons */}
            <div className="mt-6 flex gap-4">
              <button
                onClick={saveTagLibrary}
                disabled={tagSaving}
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-purple-300 disabled:to-purple-300 text-white rounded-lg transition font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl"
              >
                {tagSaving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>💾 Save Changes</>
                )}
              </button>
              <button
                onClick={loadTagLibrary}
                disabled={tagLoading || tagSaving}
                className="px-8 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded-lg transition font-semibold shadow-lg hover:shadow-xl"
              >
                🔄 Reload
              </button>
            </div>

            {/* Help Text */}
            <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-3 text-lg">💡 How to use:</h3>
              <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-2 list-disc list-inside">
                <li>Select text you want to format</li>
                <li>Click a formatting button to transform the selected text</li>
                <li>Use "Lines → Comma-separated" to convert newline-separated items to comma format</li>
                <li>Use "Lowercase" to normalize capitalization</li>
                <li>Use "Remove Duplicates" to clean up repeated tags</li>
                <li>Use "Sort A-Z" to alphabetically order tags</li>
                <li>Click "Save Changes" when done editing</li>
              </ul>
            </div>
          </div>
        )}

        {/* AI PROMPTS TAB */}
        {activeTab === 'prompts' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
            {/* Message */}
            {promptsMessage && (
              <div className={`mb-6 p-4 rounded-lg ${
                promptsMessage.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              }`}>
                {promptsMessage.text}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mb-6 flex gap-3">
              <button
                onClick={saveImageTagPrompts}
                disabled={promptsSaving}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-medium hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {promptsSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={loadImageTagPrompts}
                disabled={promptsLoading || promptsSaving}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Reload
              </button>
              <button
                onClick={resetImageTagPrompts}
                disabled={promptsSaving}
                className="px-6 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Reset to Defaults
              </button>
            </div>

            {/* Prompt Fields */}
            <div className="space-y-6">
              {promptFields.map(field => (
                <div key={field.key} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <label className="block mb-2">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      {field.label}
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {field.description}
                    </p>
                  </label>
                  <textarea
                    value={prompts[field.key]}
                    onChange={(e) => updatePrompt(field.key, e.target.value)}
                    rows={field.rows}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y font-mono text-sm"
                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                  />
                </div>
              ))}
            </div>

            {/* Bottom Save Button */}
            <div className="mt-6 flex justify-center">
              <button
                onClick={saveImageTagPrompts}
                disabled={promptsSaving}
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-medium hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
              >
                {promptsSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TagLibrary;
