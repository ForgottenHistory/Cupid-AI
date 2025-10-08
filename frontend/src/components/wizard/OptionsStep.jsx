import { useState } from 'react';

const OptionsStep = ({ character, updateCharacter, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const options = character.autoGenerate || {
    datingProfile: false,
    schedule: false,
    personality: false
  };

  const toggleOption = (option) => {
    updateCharacter('autoGenerate', {
      ...options,
      [option]: !options[option]
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      await onSave();
    } catch (err) {
      console.error('Failed to save character:', err);
      setError(err.message || 'Failed to save character.');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          Select which additional features you'd like to automatically generate for this character.
          These will be created when you click <strong>Save Character</strong>.
        </p>
      </div>

      {/* Options */}
      <div className="space-y-4">
        {/* Dating Profile */}
        <div
          onClick={() => toggleOption('datingProfile')}
          className="flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-purple-400"
          style={{ borderColor: options.datingProfile ? '#a855f7' : '#d1d5db' }}
        >
          <input
            type="checkbox"
            checked={options.datingProfile}
            onChange={() => {}}
            className="mt-1 w-5 h-5 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
          />
          <div className="ml-4 flex-1">
            <h3 className="text-lg font-semibold text-gray-900">Dating Profile</h3>
            <p className="text-sm text-gray-600 mt-1">
              Generate a dating app style profile that summarizes the character's personality, interests, and what they're looking for.
              This helps guide conversations.
            </p>
          </div>
        </div>

        {/* Weekly Schedule */}
        <div
          onClick={() => toggleOption('schedule')}
          className="flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-purple-400"
          style={{ borderColor: options.schedule ? '#a855f7' : '#d1d5db' }}
        >
          <input
            type="checkbox"
            checked={options.schedule}
            onChange={() => {}}
            className="mt-1 w-5 h-5 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
          />
          <div className="ml-4 flex-1">
            <h3 className="text-lg font-semibold text-gray-900">Weekly Schedule</h3>
            <p className="text-sm text-gray-600 mt-1">
              Create a realistic weekly schedule showing when the character is online, away, busy, or offline.
              Affects response times and availability.
            </p>
          </div>
        </div>

        {/* Personality Traits */}
        <div
          onClick={() => toggleOption('personality')}
          className="flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-purple-400"
          style={{ borderColor: options.personality ? '#a855f7' : '#d1d5db' }}
        >
          <input
            type="checkbox"
            checked={options.personality}
            onChange={() => {}}
            className="mt-1 w-5 h-5 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
          />
          <div className="ml-4 flex-1">
            <h3 className="text-lg font-semibold text-gray-900">Big Five Personality</h3>
            <p className="text-sm text-gray-600 mt-1">
              Generate OCEAN personality traits (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism).
              Affects behavior like proactive messaging frequency.
            </p>
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-sm text-gray-500 pt-2 border-t border-gray-200">
        <p>💡 <strong>Tip:</strong> All of these can be generated or edited later from the character's profile in the Library.</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Save Button */}
      <div className="text-center pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg font-semibold shadow-lg"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving Character...
            </span>
          ) : (
            'Save Character'
          )}
        </button>
      </div>
    </div>
  );
};

export default OptionsStep;
