import { useState, useEffect } from 'react';
import api from '../services/api';

const BehaviorSettings = ({ onClose }) => {
  const [settings, setSettings] = useState({
    maxEmojisPerMessage: 2,
    proactiveMessageHours: 4,
    dailyProactiveLimit: 5,
    proactiveAwayChance: 50,
    proactiveBusyChance: 10,
    proactiveCheckInterval: 5,
    maxConsecutiveProactive: 4,
    proactiveCooldownMultiplier: 2.0,
    dailyLeftOnReadLimit: 10,
    leftOnReadTriggerMin: 5,
    leftOnReadTriggerMax: 15,
    leftOnReadCharacterCooldown: 120,
    pacingStyle: 'balanced',
    compactThresholdPercent: 90,
    compactTargetPercent: 70,
    keepUncompactedMessages: 30
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
      const response = await api.get('/users/behavior-settings');
      setSettings(response.data);
    } catch (err) {
      console.error('Failed to load behavior settings:', err);
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

      await api.put('/users/behavior-settings', settings);

      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save behavior settings:', err);
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setSettings({
      maxEmojisPerMessage: 2,
      proactiveMessageHours: 4,
      dailyProactiveLimit: 5,
      proactiveAwayChance: 50,
      proactiveBusyChance: 10,
      proactiveCheckInterval: 5,
      maxConsecutiveProactive: 4,
      proactiveCooldownMultiplier: 2.0,
      dailyLeftOnReadLimit: 10,
      leftOnReadTriggerMin: 5,
      leftOnReadTriggerMax: 15,
      leftOnReadCharacterCooldown: 120,
      pacingStyle: 'balanced',
      compactThresholdPercent: 90,
      compactTargetPercent: 70,
      keepUncompactedMessages: 30
    });
    setSuccess('');
    setError('');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-6 border-b border-purple-400/30 dark:border-purple-600/30 bg-gradient-to-r from-pink-500 to-purple-600 dark:from-pink-600 dark:to-purple-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Behavior Settings</h2>
              <p className="text-white/90 text-sm mt-1">Configure character behavior and messaging</p>
            </div>
            <button
              onClick={onClose}
              className="text-white/90 hover:text-white hover:bg-white/20 p-2 rounded-full transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-14rem)] custom-scrollbar">
          <div className="p-6 space-y-6">
            {/* Error/Success Messages */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg">
                {success}
              </div>
            )}

            {/* Emoji Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Max Emojis Per Message</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.maxEmojisPerMessage}</span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={settings.maxEmojisPerMessage}
                onChange={(e) => updateSetting('maxEmojisPerMessage', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>None</span>
                <span>Lots</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">How many emojis characters can use in each message</p>
            </div>

            {/* Proactive Message Timing */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Proactive Message Timing</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.proactiveMessageHours} hours</span>
              </div>
              <input
                type="range"
                min="1"
                max="24"
                step="1"
                value={settings.proactiveMessageHours}
                onChange={(e) => updateSetting('proactiveMessageHours', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>1h</span>
                <span>24h</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Minimum hours before characters send proactive messages</p>
            </div>

            {/* Daily Proactive Limit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Daily Proactive Message Limit</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.dailyProactiveLimit} per day</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={settings.dailyProactiveLimit}
                onChange={(e) => updateSetting('dailyProactiveLimit', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>1</span>
                <span>20</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Maximum proactive messages across all characters per day</p>
            </div>

            {/* Proactive Check Interval */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Proactive Check Interval</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.proactiveCheckInterval} minutes</span>
              </div>
              <input
                type="range"
                min="1"
                max="60"
                step="1"
                value={settings.proactiveCheckInterval}
                onChange={(e) => updateSetting('proactiveCheckInterval', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>1 min</span>
                <span>60 min</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">How often the system checks if characters should send proactive messages</p>
            </div>

            {/* Proactive Away Chance */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Proactive When Away</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.proactiveAwayChance}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={settings.proactiveAwayChance}
                onChange={(e) => updateSetting('proactiveAwayChance', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Never</span>
                <span>Always</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Chance characters send proactive messages when status is AWAY</p>
            </div>

            {/* Proactive Busy Chance */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Proactive When Busy</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.proactiveBusyChance}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={settings.proactiveBusyChance}
                onChange={(e) => updateSetting('proactiveBusyChance', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Never</span>
                <span>Always</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Chance characters send proactive messages when status is BUSY</p>
            </div>

            {/* Max Consecutive Proactive */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Max Consecutive Proactive</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.maxConsecutiveProactive} messages</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={settings.maxConsecutiveProactive}
                onChange={(e) => updateSetting('maxConsecutiveProactive', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>1</span>
                <span>10</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Maximum unanswered proactive messages before character unmatches. Cooldown doubles after each message.</p>
            </div>

            {/* Proactive Cooldown Multiplier */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Cooldown Multiplier</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.proactiveCooldownMultiplier.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="5.0"
                step="0.1"
                value={settings.proactiveCooldownMultiplier}
                onChange={(e) => updateSetting('proactiveCooldownMultiplier', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>1.0x (slow)</span>
                <span>5.0x (fast)</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">How quickly cooldown increases after each proactive message (base: 60 min × multiplier ^ count). Higher = faster escalation.</p>
            </div>

            {/* Left-On-Read Section Header */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Left-On-Read Behavior</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">When you read a message but don't reply, characters may follow up based on their personality</p>
            </div>

            {/* Daily Left-On-Read Limit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Daily Left-On-Read Limit</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.dailyLeftOnReadLimit} per day</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={settings.dailyLeftOnReadLimit}
                onChange={(e) => updateSetting('dailyLeftOnReadLimit', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Disabled</span>
                <span>50</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Maximum left-on-read follow-ups per day across all characters</p>
            </div>

            {/* Left-On-Read Trigger Window Min */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Trigger Window (Minimum)</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.leftOnReadTriggerMin} minutes</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={settings.leftOnReadTriggerMin}
                onChange={(e) => updateSetting('leftOnReadTriggerMin', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>1 min</span>
                <span>30 min</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Minimum time after reading before character may follow up</p>
            </div>

            {/* Left-On-Read Trigger Window Max */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Trigger Window (Maximum)</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.leftOnReadTriggerMax} minutes</span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                step="1"
                value={settings.leftOnReadTriggerMax}
                onChange={(e) => updateSetting('leftOnReadTriggerMax', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>5 min</span>
                <span>60 min</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Maximum time window for left-on-read detection</p>
            </div>

            {/* Left-On-Read Character Cooldown */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Character Cooldown</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  {settings.leftOnReadCharacterCooldown >= 60
                    ? `${(settings.leftOnReadCharacterCooldown / 60).toFixed(1)} hours`
                    : `${settings.leftOnReadCharacterCooldown} minutes`}
                </span>
              </div>
              <input
                type="range"
                min="30"
                max="480"
                step="30"
                value={settings.leftOnReadCharacterCooldown}
                onChange={(e) => updateSetting('leftOnReadCharacterCooldown', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>30 min</span>
                <span>8 hours</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Minimum time before same character can send another left-on-read follow-up</p>
            </div>

            {/* Pacing Style */}
            <div className="space-y-2">
              <label className="font-semibold text-gray-900 dark:text-gray-100">Pacing & Chemistry Style</label>
              <select
                value={settings.pacingStyle}
                onChange={(e) => updateSetting('pacingStyle', e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="slow">Slow - Takes time to develop chemistry, more resistant</option>
                <option value="balanced">Balanced - Natural progression, matches energy</option>
                <option value="forward">Forward - More direct and receptive from the start</option>
              </select>
              <p className="text-sm text-gray-600 dark:text-gray-400">How characters pace romantic/intimate development</p>
            </div>

            {/* Conversation Compacting Section Header */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Conversation Compacting</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Automatically summarize old messages to manage context window</p>
            </div>

            {/* Compact Threshold Percent */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Compact Threshold</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.compactThresholdPercent}% of context</span>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={settings.compactThresholdPercent}
                onChange={(e) => updateSetting('compactThresholdPercent', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>50%</span>
                <span>100%</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">When conversation reaches this % of context window, start compacting old messages</p>
            </div>

            {/* Compact Target Percent */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Compact Target</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.compactTargetPercent}% of context</span>
              </div>
              <input
                type="range"
                min="30"
                max="90"
                step="5"
                value={settings.compactTargetPercent}
                onChange={(e) => updateSetting('compactTargetPercent', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>30%</span>
                <span>90%</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Keep compacting until conversation is reduced to this % of context window</p>
            </div>

            {/* Keep Uncompacted Messages */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Keep Recent Messages</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.keepUncompactedMessages} messages</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={settings.keepUncompactedMessages}
                onChange={(e) => updateSetting('keepUncompactedMessages', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>10</span>
                <span>100</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Always keep this many recent messages uncompacted for context</p>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                💡 <strong>Tip:</strong> These settings affect all characters. Changes take effect immediately.
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
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 dark:from-pink-600 dark:to-purple-700 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 dark:hover:from-pink-700 dark:hover:to-purple-800 transition font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BehaviorSettings;
