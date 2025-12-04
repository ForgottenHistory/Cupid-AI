import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';

/**
 * Modal component to view and edit character's current mood
 */
const CharacterMoodModal = ({ isOpen, onClose, characterId, characterName, currentMood, onSave }) => {
  const [mood, setMood] = useState(currentMood || '');
  const [saving, setSaving] = useState(false);

  // Sync with prop when modal opens or currentMood changes
  useEffect(() => {
    if (isOpen) {
      setMood(currentMood || '');
    }
  }, [isOpen, currentMood]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!mood.trim()) return;

    setSaving(true);
    try {
      await onSave(mood.trim());
      onClose();
    } catch (error) {
      console.error('Failed to save mood:', error);
      alert('Failed to save mood. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-purple-200/50 dark:border-purple-800/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {characterName}'s Mood
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                How are they feeling right now?
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Mood
              </label>
              <input
                type="text"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., feeling flirty and playful"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                autoFocus
                maxLength={100}
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                A short phrase describing their emotional state (2-6 words)
              </p>
            </div>

            {/* Example moods */}
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Examples:
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  'feeling playful',
                  'a bit annoyed',
                  'happy and excited',
                  'curious about you',
                  'feeling romantic',
                  'tired but interested'
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => setMood(example)}
                    className="px-3 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800/40 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !mood.trim()}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Mood'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CharacterMoodModal;
