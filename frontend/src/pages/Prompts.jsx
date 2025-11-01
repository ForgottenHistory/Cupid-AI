import { useState, useEffect, useRef } from 'react';

const Prompts = () => {
  const containerRef = useRef(null);
  const [prompts, setPrompts] = useState({
    systemPrompt: '',
    contextPrompt: '',
    closingPrompt: '',
    departingPrompt: '',
    voiceMessagePrompt: '',
    proactiveFirstMessagePrompt: '',
    proactiveFreshPrompt: '',
    proactiveClosingPrompt: '',
    cleanupDescriptionPrompt: '',
    datingProfilePrompt: '',
    schedulePrompt: '',
    personalityPrompt: '',
    memoryExtractionPrompt: '',
    compactionPrompt: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Load prompts on mount
  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/prompts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load prompts');
      }

      const data = await response.json();
      setPrompts(data);
      setMessage({ type: '', text: '' });
    } catch (error) {
      console.error('Failed to load prompts:', error);
      setMessage({ type: 'error', text: 'Failed to load prompts' });
    } finally {
      setLoading(false);
    }
  };

  const savePrompts = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/prompts', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompts })
      });

      if (!response.ok) {
        throw new Error('Failed to save prompts');
      }

      setMessage({ type: 'success', text: 'Prompts saved successfully!' });
      if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Failed to save prompts:', error);
      setMessage({ type: 'error', text: 'Failed to save prompts' });
      if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setSaving(false);
    }
  };

  const resetPrompts = async () => {
    if (!confirm('Reset all prompts to defaults? This cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/prompts/reset', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to reset prompts');
      }

      const data = await response.json();
      setPrompts(data.prompts);
      setMessage({ type: 'success', text: 'Prompts reset to defaults!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Failed to reset prompts:', error);
      setMessage({ type: 'error', text: 'Failed to reset prompts' });
    } finally {
      setSaving(false);
    }
  };

  const updatePrompt = (key, value) => {
    setPrompts(prev => ({ ...prev, [key]: value }));
  };

  // Calculate approximate token count (1 token ≈ 4 characters)
  const calculateConversationTokens = () => {
    const conversationKeys = conversationPromptFields.map(f => f.key);
    const totalChars = conversationKeys.reduce((sum, key) => sum + prompts[key].length, 0);
    return Math.ceil(totalChars / 4);
  };

  const calculateFieldTokens = (key) => {
    return Math.ceil(prompts[key].length / 4);
  };

  const conversationPromptFields = [
    {
      key: 'systemPrompt',
      label: 'System Prompt',
      description: 'Main instructions for character behavior and messaging style',
      rows: 20
    },
    {
      key: 'contextPrompt',
      label: 'Context Prompt',
      description: 'Background context about the dating app',
      rows: 3
    },
    {
      key: 'closingPrompt',
      label: 'Closing Prompt',
      description: 'Final instructions at the end of the system prompt',
      rows: 2
    },
    {
      key: 'departingPrompt',
      label: 'Departing Prompt',
      description: 'Instructions when character needs to wrap up conversation',
      rows: 4
    },
    {
      key: 'voiceMessagePrompt',
      label: 'Voice Message Prompt',
      description: 'Instructions when sending a voice message',
      rows: 2
    },
    {
      key: 'proactiveFirstMessagePrompt',
      label: 'Proactive First Message (Icebreaker)',
      description: 'Instructions for first message after matching',
      rows: 5
    },
    {
      key: 'proactiveFreshPrompt',
      label: 'Proactive Fresh Start',
      description: 'Instructions to start a completely new conversation (only message type used)',
      rows: 2
    },
    {
      key: 'proactiveClosingPrompt',
      label: 'Proactive Closing',
      description: 'Final instructions for proactive messages',
      rows: 2
    }
  ];

  const characterGenerationPromptFields = [
    {
      key: 'cleanupDescriptionPrompt',
      label: 'Cleanup Description',
      description: 'AI prompt for cleaning up imported character descriptions (remove formatting, placeholders, etc.)',
      rows: 8
    },
    {
      key: 'datingProfilePrompt',
      label: 'Dating Profile Generation',
      description: 'AI prompt for generating dating profiles from character descriptions. Use {characterName} and {description} as placeholders.',
      rows: 12
    },
    {
      key: 'schedulePrompt',
      label: 'Schedule Generation',
      description: 'AI prompt for generating weekly schedules. Use {characterName} and {description} as placeholders.',
      rows: 10
    },
    {
      key: 'personalityPrompt',
      label: 'Big Five Personality Generation',
      description: 'AI prompt for generating OCEAN personality traits. Use {characterName}, {description}, and {personality} as placeholders.',
      rows: 10
    },
    {
      key: 'memoryExtractionPrompt',
      label: 'Memory Extraction',
      description: 'AI prompt for extracting long-term memories from conversations. Use {characterName}, {conversationHistory}, {existingCount}, and {existingMemories} as placeholders.',
      rows: 30
    },
    {
      key: 'compactionPrompt',
      label: 'Conversation Compaction',
      description: 'AI prompt for summarizing old conversation blocks to save context window space. Use {characterName}, {userName}, and {conversationText} as placeholders.',
      rows: 12
    }
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading prompts...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto custom-scrollbar bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-5xl mx-auto px-8 py-12 pb-24">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            AI Behavior Prompts
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure how AI characters behave, respond, and communicate
          </p>
        </div>


        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={savePrompts}
            disabled={saving}
            className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-medium hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            onClick={loadPrompts}
            disabled={loading || saving}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Reload
          </button>
          <button
            onClick={resetPrompts}
            disabled={saving}
            className="px-6 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Reset to Defaults
          </button>
        </div>

        {/* Conversation Behavior Prompts */}
        <div className="space-y-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Conversation Behavior
            </h2>
            {/* Token Counter */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-semibold text-blue-800 dark:text-blue-300">
                  Conversation Behavior Tokens:
                </span>
                <span className="text-blue-700 dark:text-blue-400 font-mono">
                  ~{calculateConversationTokens().toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          {conversationPromptFields.map(field => (
            <div key={field.key} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
              <label className="block mb-2">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {field.label}
                </span>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {field.description}
                </p>
              </label>
              <textarea
                value={prompts[field.key]}
                onChange={(e) => updatePrompt(field.key, e.target.value)}
                rows={field.rows}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-y font-mono text-sm"
                placeholder={`Enter ${field.label.toLowerCase()}...`}
              />
            </div>
          ))}
        </div>

        {/* Separator */}
        <div className="my-12 border-t-2 border-purple-200 dark:border-purple-800"></div>

        {/* Character Generation Prompts */}
        <div className="space-y-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Character Generation & Dating Profile
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              AI prompts for generating character profiles, schedules, and personality traits. Use placeholder variables like {'{'}characterName{'}'} and {'{'}description{'}'} where needed.
            </p>
          </div>
          {characterGenerationPromptFields.map(field => (
            <div key={field.key} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
              <label className="block mb-2">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {field.label}
                  </span>
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-mono">
                    ~{calculateFieldTokens(field.key).toLocaleString()} tokens
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {field.description}
                </p>
              </label>
              <textarea
                value={prompts[field.key]}
                onChange={(e) => updatePrompt(field.key, e.target.value)}
                rows={field.rows}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-y font-mono text-sm"
                placeholder={`Enter ${field.label.toLowerCase()}...`}
              />
            </div>
          ))}
        </div>

        {/* Bottom Save Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={savePrompts}
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-medium hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Prompts;
