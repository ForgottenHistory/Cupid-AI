import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';

/**
 * Modal component for editing character-specific post instructions
 */
const PostInstructionsModal = ({ isOpen, onClose, characterId, characterName, onSave }) => {
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing post instructions when modal opens
  useEffect(() => {
    if (isOpen && characterId) {
      loadInstructions();
    }
  }, [isOpen, characterId]);

  const loadInstructions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/characters/${characterId}/post-instructions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setInstructions(data.postInstructions || '');
        setHasChanges(false);
      } else {
        console.error('Failed to load post instructions');
      }
    } catch (error) {
      console.error('Error loading post instructions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/characters/${characterId}/post-instructions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ postInstructions: instructions.trim() })
      });

      if (response.ok) {
        setHasChanges(false);
        if (onSave) {
          onSave(instructions.trim());
        }
        onClose();
      } else {
        alert('Failed to save post instructions. Please try again.');
      }
    } catch (error) {
      console.error('Error saving post instructions:', error);
      alert('Error saving post instructions. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-purple-200/50 dark:border-purple-800/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Post Instructions
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Additional instructions for {characterName}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  These instructions will be appended to the chat prompt <strong>after the closing prompt</strong>,
                  giving you fine-grained control over {characterName}'s behavior in conversations.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Tip:</strong> Use this to add specific behaviors, personality tweaks, or response styles
                    that should only apply to this character's chats.
                  </p>
                </div>
              </div>

              <textarea
                value={instructions}
                onChange={(e) => {
                  setInstructions(e.target.value);
                  setHasChanges(true);
                }}
                placeholder={`Example: "Always end messages with a question to keep the conversation flowing."\n\nOr: "Use more slang and casual language."\n\nOr leave empty for default behavior.`}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
                rows={12}
                disabled={saving}
              />

              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Character count: {instructions.length}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PostInstructionsModal;
