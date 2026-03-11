import { useState, useCallback, useMemo } from 'react';
import characterService from '../services/characterService';
import api from '../services/api';
import { getImageUrl } from '../services/api';
import ActivityChatSession from './ActivityChatSession';

function IcebreakerSession({ user, onBack }) {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'loading' | 'question' | 'chatting'
  const [character, setCharacter] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState(null);
  const [skipping, setSkipping] = useState(false);

  const getCharacterImageUrl = useCallback(() => {
    const imgUrl = character?.imageUrl || character?.image_url;
    if (!imgUrl) return null;
    if (imgUrl.startsWith('data:')) return imgUrl;
    return getImageUrl(imgUrl);
  }, [character]);

  const characterName = character?.cardData?.data?.name || character?.cardData?.name || character?.name || 'Character';

  const loadQuestion = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const settingsRes = await api.get('/users/activities-settings');
      const settings = settingsRes.data;

      const selectedCharacter = await characterService.getRandomOnlineCharacter(
        user.id,
        settings.activitiesIncludeAway,
        settings.activitiesIncludeBusy
      );

      if (!selectedCharacter) {
        setError('No characters available. Make sure you have unmatched characters with schedules that are currently online.');
        setPhase('idle');
        return;
      }

      setCharacter(selectedCharacter);

      const res = await api.post('/random-chat/icebreaker-question', { characterId: selectedCharacter.id });
      setQuestion(res.data.question);
      setAnswer('');
      setPhase('question');
    } catch (err) {
      console.error('Failed to load icebreaker question:', err);
      setError(err.response?.data?.error || 'Failed to load question. Please try again.');
      setPhase('idle');
    }
  }, [user]);

  const handleSkip = useCallback(async () => {
    setSkipping(true);
    try {
      await loadQuestion();
    } finally {
      setSkipping(false);
    }
  }, [loadQuestion]);

  const handleAnswer = useCallback(() => {
    if (!answer.trim()) return;
    setPhase('chatting');
  }, [answer]);

  const activityContext = useMemo(() => {
    if (!question || !answer) return '';
    return `You asked them an icebreaker question: "${question}" and they answered: "${answer}". Continue the conversation naturally from their answer. Be engaging and reference what they said.`;
  }, [question, answer]);

  // CHATTING phase - hand off to ActivityChatSession
  if (phase === 'chatting') {
    return (
      <ActivityChatSession
        user={user}
        mode="icebreaker"
        onBack={onBack}
        initialCharacter={character}
        activityContext={activityContext}
      />
    );
  }

  // IDLE phase
  if (phase === 'idle') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="text-center max-w-md">
          <button onClick={onBack} className="absolute top-4 left-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Icebreaker</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            A character asks you a question. Answer to start a timed chat, or skip to meet someone new!
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={loadQuestion}
            className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-full hover:opacity-90 transition shadow-lg hover:shadow-xl"
          >
            Start Icebreaker
          </button>
        </div>
      </div>
    );
  }

  // LOADING phase
  if (phase === 'loading') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          {skipping ? 'Finding someone new...' : 'Finding someone for you...'}
        </p>
      </div>
    );
  }

  // QUESTION phase
  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-cyan-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 overflow-y-auto">
      {/* Back button */}
      <div className="flex-shrink-0 px-6 pt-4">
        <button onClick={onBack} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg transition">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Main content - centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-8">
        <div className="max-w-lg w-full">
          {/* Character card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-blue-100 dark:border-gray-700 mb-6">
            {/* Character image + name header */}
            <div className="flex items-center gap-4 p-5 border-b border-gray-100 dark:border-gray-700">
              {getCharacterImageUrl() ? (
                <img src={getCharacterImageUrl()} alt={characterName} className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-400 shadow-md" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center ring-2 ring-blue-400 shadow-md">
                  <span className="text-xl font-bold text-white">{characterName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">{characterName}</h3>
                <p className="text-sm text-blue-500 dark:text-blue-400">asks you...</p>
              </div>
            </div>

            {/* Question bubble */}
            <div className="p-5">
              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-blue-900/30 dark:to-cyan-900/20 rounded-2xl p-5 border border-blue-100/50 dark:border-blue-800/30">
                <p className="text-gray-800 dark:text-gray-200 text-lg leading-relaxed">
                  {question}
                </p>
              </div>
            </div>
          </div>

          {/* Answer input */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-blue-100 dark:border-gray-700 mb-4">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer..."
              className="w-full p-4 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:outline-none"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAnswer();
                }
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              disabled={skipping}
              className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50"
            >
              {skipping ? 'Skipping...' : 'Skip'}
            </button>
            <button
              onClick={handleAnswer}
              disabled={!answer.trim()}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-full hover:opacity-90 transition shadow-lg disabled:opacity-50"
            >
              Answer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IcebreakerSession;
