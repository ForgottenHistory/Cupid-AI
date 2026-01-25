import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const ActivitiesSettingsPage = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [settings, setSettings] = useState({
    activitiesIncludeAway: false,
    activitiesIncludeBusy: false,
    activitiesChatDuration: 10,
    activitiesUserFirstChance: 50,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/activities-settings');
      setSettings(response.data);
    } catch (err) {
      console.error('Failed to load activities settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await api.put('/users/activities-settings', settings);

      setSuccess('Settings saved successfully!');
      if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save activities settings:', err);
      setError(err.response?.data?.error || 'Failed to save settings');
      if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setSettings({
      activitiesIncludeAway: false,
      activitiesIncludeBusy: false,
      activitiesChatDuration: 10,
      activitiesUserFirstChance: 50,
    });
    setSuccess('');
    setError('');
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/activities')}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-2 mb-4 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Activities
          </button>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Activities Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Configure how Activities mode selects characters</p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <div className="p-6 space-y-6">
            {/* Messages */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg text-green-700 dark:text-green-300 text-sm">
                {success}
              </div>
            )}

            {/* Character Selection Section */}
            <div className="pb-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Character Selection</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">By default, Activities only matches you with characters who are currently Online. Enable these options to include characters with other statuses.</p>
            </div>

            {/* Include Away Characters */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Include Away Characters</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.activitiesIncludeAway}
                    onChange={(e) => updateSetting('activitiesIncludeAway', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">When enabled, characters with "Away" status can be matched in Random Chat and Blind Date</p>
            </div>

            {/* Include Busy Characters */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Include Busy Characters</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.activitiesIncludeBusy}
                    onChange={(e) => updateSetting('activitiesIncludeBusy', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">When enabled, characters with "Busy" status can be matched in Random Chat and Blind Date</p>
            </div>

            {/* Chat Duration Section */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Session Settings</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Configure how long activity sessions last</p>
            </div>

            {/* Chat Duration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Chat Duration</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.activitiesChatDuration} minutes</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={settings.activitiesChatDuration}
                onChange={(e) => updateSetting('activitiesChatDuration', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>1 min</span>
                <span>30 min</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">How long each Random Chat or Blind Date session lasts before the decision phase</p>
            </div>

            {/* Character First Chance */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Character First Message Chance</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.activitiesUserFirstChance}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={settings.activitiesUserFirstChance}
                onChange={(e) => updateSetting('activitiesUserFirstChance', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>0% (You always first)</span>
                <span>100% (Character always first)</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Chance for the character to send the first message. At 0%, you always get to write first. At 100%, the character always starts the conversation.</p>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Note: Offline characters are never included in Activities regardless of these settings.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
            <button
              type="button"
              onClick={resetToDefaults}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition font-medium"
            >
              Reset to Defaults
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/activities')}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 dark:from-pink-600 dark:to-purple-700 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 dark:hover:from-pink-700 dark:hover:to-purple-800 transition font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActivitiesSettingsPage;
