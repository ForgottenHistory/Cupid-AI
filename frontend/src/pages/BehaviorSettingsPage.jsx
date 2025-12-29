import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const BehaviorSettingsPage = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [settings, setSettings] = useState({
    proactiveMessageHours: 4,
    dailyProactiveLimit: 5,
    proactiveOnlineChance: 100,
    proactiveAwayChance: 50,
    proactiveBusyChance: 10,
    proactiveCheckInterval: 5,
    maxConsecutiveProactive: 4,
    proactiveCooldownMultiplier: 2.0,
    pacingStyle: 'balanced',
    compactThresholdPercent: 90,
    compactTargetPercent: 70,
    keepUncompactedMessages: 30,
    autoUnmatchInactiveDays: 0,
    autoUnmatchAfterProactive: true,
    allowAiUnmatch: true,
    dailyAutoMatchEnabled: true,
    dailySwipeLimit: 5,
    compactionEnabled: true,
    maxMemories: 50,
    maxMatches: 0,
    thoughtFrequency: 10,
    memoryDegradationPoints: 0,
    includeFullSchedule: false,
    retryOnInvalidResponse: true,
    useNamePrimer: true
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
      if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save behavior settings:', err);
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
      proactiveMessageHours: 4,
      dailyProactiveLimit: 5,
      proactiveOnlineChance: 100,
      proactiveAwayChance: 50,
      proactiveBusyChance: 10,
      proactiveCheckInterval: 5,
      maxConsecutiveProactive: 4,
      proactiveCooldownMultiplier: 2.0,
      pacingStyle: 'balanced',
      compactThresholdPercent: 90,
      compactTargetPercent: 70,
      keepUncompactedMessages: 30,
      autoUnmatchInactiveDays: 0,
      dailyAutoMatchEnabled: true,
      dailySwipeLimit: 5,
      compactionEnabled: true,
      maxMemories: 50,
      maxMatches: 0,
      thoughtFrequency: 10,
      includeFullSchedule: false,
      retryOnInvalidResponse: true,
      useNamePrimer: true
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
            onClick={() => navigate('/')}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-2 mb-4 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Behavior Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Configure character behavior and messaging</p>
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

            {/* Proactive Messaging Section Header */}
            <div className="pb-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Proactive Messaging</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">After a period of silence (set by Proactive Message Timing), characters may message you first. The system checks periodically (set by Check Interval), and each check rolls against the chance percentage for the character's current status. If the roll succeeds, a second probability check based on time gap and personality determines if the message is actually sent.</p>
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
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  {settings.dailyProactiveLimit === 0 ? 'Unlimited' : `${settings.dailyProactiveLimit} per day`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={settings.dailyProactiveLimit}
                onChange={(e) => updateSetting('dailyProactiveLimit', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Unlimited</span>
                <span>20</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Maximum proactive messages across all characters per day (0 = unlimited)</p>
            </div>

            {/* Proactive Check Interval */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Proactive Check Interval</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.proactiveCheckInterval} minutes</span>
              </div>
              <input
                type="range"
                min="5"
                max="300"
                step="5"
                value={settings.proactiveCheckInterval}
                onChange={(e) => updateSetting('proactiveCheckInterval', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>5 min</span>
                <span>5 hours</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">How often the system checks if characters should send proactive messages</p>
            </div>

            {/* Proactive Online Chance */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Proactive When Online</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{settings.proactiveOnlineChance}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={settings.proactiveOnlineChance}
                onChange={(e) => updateSetting('proactiveOnlineChance', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Never</span>
                <span>Always</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Chance characters send proactive messages when status is ONLINE</p>
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
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  {settings.maxConsecutiveProactive === 0 ? 'Unlimited' : `${settings.maxConsecutiveProactive} messages`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={settings.maxConsecutiveProactive}
                onChange={(e) => updateSetting('maxConsecutiveProactive', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Unlimited</span>
                <span>10</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Maximum unanswered proactive messages before cooldown escalation stops. Cooldown doubles after each message. (0 = unlimited, no cap)</p>
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

            {/* Left-On-Read Section - HIDDEN (not working) */}
            {false && (
              <>
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
              </>
            )}

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

            {/* Thought Frequency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Thought Frequency</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  {settings.thoughtFrequency === 0 ? 'Disabled' : `Every ${settings.thoughtFrequency} messages`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="1"
                value={settings.thoughtFrequency}
                onChange={(e) => updateSetting('thoughtFrequency', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Disabled</span>
                <span>Every 25</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">How often characters share their internal thoughts with you. Thoughts reveal what they're really thinking about the conversation. (0 = disabled)</p>
            </div>

            {/* Prompt Options Section Header */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Prompt Options</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Additional context to include in the AI prompt</p>
            </div>

            {/* Include Full Schedule */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Include Full Schedule in Prompt</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeFullSchedule}
                    onChange={(e) => updateSetting('includeFullSchedule', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">When enabled, the character's complete weekly schedule will be included in the chat prompt. This uses more tokens but gives the AI better context about the character's availability.</p>
            </div>

            {/* Retry on Invalid Response */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Retry on Invalid Response</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.retryOnInvalidResponse}
                    onChange={(e) => updateSetting('retryOnInvalidResponse', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">When enabled, automatically retry up to 3 times if the AI returns an invalid response (empty content, duplicate message, etc.)</p>
            </div>

            {/* Use Name Primer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Use Name Primer</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.useNamePrimer}
                    onChange={(e) => updateSetting('useNamePrimer', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">When enabled, adds the character's name as a response primer (e.g., "Character: "). This helps guide the model but may interfere with thinking/reasoning models. Disable if responses contain leaked reasoning.</p>
            </div>

            {/* Conversation Compacting Section Header */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Conversation Compacting</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Automatically summarize old messages to manage context window</p>
            </div>

            {/* Compaction Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Enable Compaction</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.compactionEnabled}
                    onChange={(e) => updateSetting('compactionEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">When disabled, conversations will grow indefinitely without AI summarization (may exceed context window)</p>
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

            {/* Memory System Section Header */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Long-Term Memory System</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">AI extracts and stores important facts from conversations. Needs Compaction to be enabled.</p>
            </div>

            {/* Max Memories */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Maximum Memories Per Character</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  {settings.maxMemories === 0 ? 'Disabled' : `${settings.maxMemories} memories`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={settings.maxMemories}
                onChange={(e) => updateSetting('maxMemories', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Disabled</span>
                <span>100</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Maximum important facts AI can remember about conversations. Lowest importance memories are pruned when limit is reached. (0 = disabled, no memories extracted)</p>
            </div>

            {/* Memory Degradation Points */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Memory Degradation</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  {settings.memoryDegradationPoints === 0 ? 'Disabled' : `${settings.memoryDegradationPoints} points`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={settings.memoryDegradationPoints}
                onChange={(e) => updateSetting('memoryDegradationPoints', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Disabled</span>
                <span>100 points</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">When new memories are created, existing memories lose this many importance points. Higher values make old memories fade faster (0 = disabled)</p>
            </div>

            {/* Auto-Unmatch Section Header */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Auto-Unmatch Settings</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Configure when characters automatically unmatch</p>
            </div>

            {/* Auto-Unmatch After Consecutive Proactive Messages */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Unmatch After Consecutive Proactive</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoUnmatchAfterProactive}
                    onChange={(e) => updateSetting('autoUnmatchAfterProactive', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">When enabled, characters will unmatch after reaching the max consecutive proactive messages limit without a response. When disabled, they just stop sending more proactive messages.</p>
            </div>

            {/* Auto-Unmatch After Inactivity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Unmatch After Inactivity</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  {settings.autoUnmatchInactiveDays === 0 ? 'Disabled' : `${settings.autoUnmatchInactiveDays} days`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="90"
                step="1"
                value={settings.autoUnmatchInactiveDays}
                onChange={(e) => updateSetting('autoUnmatchInactiveDays', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Disabled</span>
                <span>90 days</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Automatically unmatch characters after this many days with no messages from either party (0 = disabled)</p>
            </div>

            {/* Allow AI-Initiated Unmatch */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Allow AI-Initiated Unmatch</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowAiUnmatch}
                    onChange={(e) => updateSetting('allowAiUnmatch', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">When enabled, characters can decide to unmatch based on conversation context (e.g., if the user is being rude). When disabled, only automatic unmatch rules apply.</p>
            </div>

            {/* Daily Swipe Limit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Daily Swipe Limit</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  {settings.dailySwipeLimit === 0 ? 'Unlimited' : `${settings.dailySwipeLimit} per day`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={settings.dailySwipeLimit}
                onChange={(e) => updateSetting('dailySwipeLimit', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Unlimited</span>
                <span>10</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Maximum swipes (likes/passes) allowed per day in the Discover tab (0 = unlimited)</p>
            </div>

            {/* Max Matches */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Max Matches at Once</label>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  {settings.maxMatches === 0 ? 'Unlimited' : `${settings.maxMatches} matches`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={settings.maxMatches}
                onChange={(e) => updateSetting('maxMatches', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Unlimited</span>
                <span>50</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Maximum number of active matches you can have at once. When at the limit, you can't match in Discover or receive auto-matches (0 = unlimited)</p>
            </div>

            {/* Daily Auto-Match Section Header */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Daily Auto-Match</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Automatically get matched with a random character from your library each day</p>
            </div>

            {/* Daily Auto-Match Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-900 dark:text-gray-100">Enable Daily Auto-Match</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.dailyAutoMatchEnabled}
                    onChange={(e) => updateSetting('dailyAutoMatchEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">When enabled, you'll be automatically matched with one random character from your library each day at midnight</p>
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
                onClick={() => navigate('/')}
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

export default BehaviorSettingsPage;
