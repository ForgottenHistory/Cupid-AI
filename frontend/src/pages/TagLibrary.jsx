import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

/**
 * Tag Library Page
 * Full page for editing the Danbooru tag library with auto-formatting tools
 */
const TagLibrary = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedText, setSelectedText] = useState('');

  // Load tag library on mount
  useEffect(() => {
    loadTagLibrary();
  }, []);

  const loadTagLibrary = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:3000/api/tag-library', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setContent(response.data.content);
      setMessage(null);
    } catch (error) {
      console.error('Failed to load tag library:', error);
      setMessage({ type: 'error', text: 'Failed to load tag library' });
    } finally {
      setLoading(false);
    }
  };

  const saveTagLibrary = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      await axios.put('http://localhost:3000/api/tag-library',
        { content },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setMessage({ type: 'success', text: 'Tag library saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save tag library:', error);
      setMessage({ type: 'error', text: 'Failed to save tag library' });
    } finally {
      setSaving(false);
    }
  };

  // Formatting utilities
  const formatToCommaSeparated = () => {
    if (!selectedText) {
      setMessage({ type: 'error', text: 'Please select text to format' });
      return;
    }

    // Split by newlines, trim, filter empty, join with comma
    const formatted = selectedText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))
      .join(', ');

    // Replace selected text with formatted version
    const textarea = document.getElementById('tag-editor');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + formatted + content.substring(end);
    setContent(newContent);
    setMessage({ type: 'success', text: 'Formatted to comma-separated' });
    setTimeout(() => setMessage(null), 2000);
  };

  const convertToLowercase = () => {
    if (!selectedText) {
      setMessage({ type: 'error', text: 'Please select text to convert' });
      return;
    }

    const textarea = document.getElementById('tag-editor');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + selectedText.toLowerCase() + content.substring(end);
    setContent(newContent);
    setMessage({ type: 'success', text: 'Converted to lowercase' });
    setTimeout(() => setMessage(null), 2000);
  };

  const removeDuplicates = () => {
    if (!selectedText) {
      setMessage({ type: 'error', text: 'Please select comma-separated tags to deduplicate' });
      return;
    }

    // Split by comma, trim, remove duplicates
    const tags = selectedText
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    const unique = [...new Set(tags)];
    const formatted = unique.join(', ');

    const textarea = document.getElementById('tag-editor');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + formatted + content.substring(end);
    setContent(newContent);
    setMessage({ type: 'success', text: `Removed ${tags.length - unique.length} duplicates` });
    setTimeout(() => setMessage(null), 2000);
  };

  const sortAlphabetically = () => {
    if (!selectedText) {
      setMessage({ type: 'error', text: 'Please select comma-separated tags to sort' });
      return;
    }

    // Split by comma, trim, sort, join
    const sorted = selectedText
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .sort()
      .join(', ');

    const textarea = document.getElementById('tag-editor');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + sorted + content.substring(end);
    setContent(newContent);
    setMessage({ type: 'success', text: 'Sorted alphabetically' });
    setTimeout(() => setMessage(null), 2000);
  };

  // Track selected text
  const handleTextSelection = () => {
    const textarea = document.getElementById('tag-editor');
    const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    setSelectedText(selected);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading tag library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-2 mb-4 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Danbooru Tag Library
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Edit the tag library used for AI image generation. Select text and use formatting tools below.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
          {/* Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            }`}>
              {message.text}
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
            value={content}
            onChange={(e) => setContent(e.target.value)}
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
              disabled={saving}
              className="px-8 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-purple-300 disabled:to-purple-300 text-white rounded-lg transition font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  💾 Save Changes
                </>
              )}
            </button>
            <button
              onClick={loadTagLibrary}
              disabled={loading || saving}
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
      </div>
    </div>
  );
};

export default TagLibrary;
