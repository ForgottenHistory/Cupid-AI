import { useState, useEffect } from 'react';
import api from '../../services/api';

const VoiceTab = ({ character, onUpdate }) => {
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(character.voiceId || null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadVoices();
  }, []);

  const loadVoices = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tts/voices');
      setVoices(response.data.voices || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load voices:', err);
      setError('Failed to load voices. Make sure the TTS server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVoice = async () => {
    try {
      setSaving(true);
      setError(null);

      // Update voice assignment in backend
      await api.put(`/characters/${character.id}/voice`, {
        voice_id: selectedVoice
      });

      // Update local character data
      if (onUpdate) {
        onUpdate();
      }

      alert('Voice assigned successfully!');
    } catch (err) {
      console.error('Failed to assign voice:', err);
      setError(err.response?.data?.error || 'Failed to assign voice');
    } finally {
      setSaving(false);
    }
  };

  const handleClearVoice = async () => {
    try {
      setSaving(true);
      setError(null);

      // Clear voice assignment in backend
      await api.put(`/characters/${character.id}/voice`, {
        voice_id: null
      });

      setSelectedVoice(null);

      // Update local character data
      if (onUpdate) {
        onUpdate();
      }

      alert('Voice cleared successfully!');
    } catch (err) {
      console.error('Failed to clear voice:', err);
      setError(err.response?.data?.error || 'Failed to clear voice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p>Assign a voice to this character for voice messages in chat.</p>
        <p className="mt-2">The AI will occasionally send voice messages instead of text based on conversation context and character personality.</p>
        <p className="mt-2">💡 <strong>Tip:</strong> Go to the <a href="/voices" className="text-purple-600 dark:text-purple-400 hover:underline">Voice Library</a> to test voices before assigning them.</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Loading voices...
        </div>
      ) : voices.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No voices available. Upload a voice sample first!
          </p>
          <a
            href="/voices"
            className="inline-block px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:from-pink-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
          >
            Go to Voice Library
          </a>
        </div>
      ) : (
        <>
          {/* Voice Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Voice
            </label>

            <div className="space-y-2">
              {/* No voice option */}
              <label
                className={`flex items-center justify-between p-4 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm rounded-xl border-2 cursor-pointer transition-all ${
                  selectedVoice === null
                    ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/20'
                    : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="voice"
                    checked={selectedVoice === null}
                    onChange={() => setSelectedVoice(null)}
                    className="w-4 h-4 text-purple-600"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">No Voice</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Text messages only</p>
                  </div>
                </div>
              </label>

              {/* Voice options */}
              {voices.map((voice) => (
                <label
                  key={voice.name}
                  className={`flex items-center justify-between p-4 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm rounded-xl border-2 cursor-pointer transition-all ${
                    selectedVoice === voice.name
                      ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/20'
                      : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="voice"
                      checked={selectedVoice === voice.name}
                      onChange={() => setSelectedVoice(voice.name)}
                      className="w-4 h-4 text-purple-600"
                    />
                    <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{voice.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {voice.duration_seconds}s • {voice.sample_rate}Hz
                      </p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSaveVoice}
              disabled={saving || selectedVoice === character.voiceId}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl disabled:hover:shadow-lg"
            >
              {saving ? 'Saving...' : 'Save Voice Assignment'}
            </button>

            {character.voiceId && (
              <button
                onClick={handleClearVoice}
                disabled={saving}
                className="px-6 py-3 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl font-semibold hover:bg-white/80 dark:hover:bg-gray-700/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Clear Voice
              </button>
            )}
          </div>
        </>
      )}

      {/* Help Text */}
      <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
        <p>💡 <strong>Tips:</strong></p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Voice messages will appear as audio players in chat</li>
          <li>The AI decides when to send voice vs text based on context</li>
          <li>Longer or more emotional messages are more likely to be voice</li>
        </ul>
      </div>
    </div>
  );
};

export default VoiceTab;
