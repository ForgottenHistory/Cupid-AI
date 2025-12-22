import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';

// State ID to display name mapping (same as CharacterStatusBar)
const STATE_OPTIONS = [
  { id: 'none', label: 'None (Clear State)' },
  { id: 'drunk', label: 'Drunk' },
  { id: 'high', label: 'High' },
  { id: 'showering', label: 'In the Shower' },
  { id: 'bath', label: 'Taking a Bath' },
  { id: 'sleeping', label: 'Asleep' },
  { id: 'masturbating', label: 'Masturbating' },
  { id: 'having_sex', label: 'Having Sex' },
  { id: 'post_sex', label: 'Post-Sex Afterglow' },
  { id: 'crying', label: 'Crying/Upset' },
  { id: 'angry', label: 'Angry/Pissed' },
  { id: 'exercising', label: 'Working Out' },
  { id: 'eating', label: 'Eating' },
  { id: 'driving', label: 'Driving' },
  { id: 'at_work', label: 'At Work' },
  { id: 'in_meeting', label: 'In a Meeting' },
  { id: 'watching_movie', label: 'Watching Something' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'with_friends', label: 'With Friends' },
  { id: 'on_date', label: 'On a Date' },
  { id: 'cooking', label: 'Cooking' },
  { id: 'sick', label: 'Feeling Sick' },
  { id: 'hungover', label: 'Hungover' },
  { id: 'horny', label: 'Horny/Aroused' },
  { id: 'bored', label: 'Extremely Bored' },
  { id: 'anxious', label: 'Anxious/Nervous' },
  { id: 'excited', label: 'Super Excited' },
  { id: 'sleepy', label: 'Half-Asleep' },
];

/**
 * Modal component to view and edit character's current state
 */
const CharacterStateModal = ({ isOpen, onClose, characterId, characterName, currentState, onSave }) => {
  const [selectedState, setSelectedState] = useState(currentState || 'none');
  const [saving, setSaving] = useState(false);

  // Sync with prop when modal opens or currentState changes
  useEffect(() => {
    if (isOpen) {
      setSelectedState(currentState || 'none');
    }
  }, [isOpen, currentState]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Pass null for 'none' to clear the state
      await onSave(selectedState === 'none' ? null : selectedState);
      onClose();
    } catch (error) {
      console.error('Failed to save state:', error);
      alert('Failed to save state. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-orange-200/50 dark:border-orange-800/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {characterName}'s State
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                What are they doing right now?
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
                Current State
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2">
                {STATE_OPTIONS.map((state) => (
                  <button
                    key={state.id}
                    onClick={() => setSelectedState(state.id)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-all text-left ${
                      selectedState === state.id
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                    }`}
                  >
                    {state.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                States affect how the character behaves and responds
              </p>
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
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save State'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CharacterStateModal;
