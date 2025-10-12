import { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Tag Library Editor Component
 * Allows editing the Danbooru tag library with auto-formatting tools
 */
const TagLibraryEditor = () => {
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
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          Danbooru Tag Library
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Edit the tag library used for AI image generation. Select text and use formatting tools below.
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Formatting Tools */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={formatToCommaSeparated}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition text-sm font-medium"
          title="Convert selected lines to comma-separated format"
        >
          📝 Lines → Comma-separated
        </button>
        <button
          onClick={convertToLowercase}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition text-sm font-medium"
          title="Convert selected text to lowercase"
        >
          🔡 Lowercase
        </button>
        <button
          onClick={removeDuplicates}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition text-sm font-medium"
          title="Remove duplicate tags from selected comma-separated list"
        >
          🗑️ Remove Duplicates
        </button>
        <button
          onClick={sortAlphabetically}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition text-sm font-medium"
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
        className="w-full h-[500px] p-4 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
        spellCheck={false}
      />

      {/* Action Buttons */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={saveTagLibrary}
          disabled={saving}
          className="px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white rounded-lg transition font-medium flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
          className="px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded-lg transition font-medium"
        >
          🔄 Reload
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">💡 How to use:</h3>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
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
  );
};

export default TagLibraryEditor;
