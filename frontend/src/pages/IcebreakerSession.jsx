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
    <div className="h-full flex overflow-hidden">
      {/* Left panel - Full-height character image */}
      <div className="relative w-[45%] flex-shrink-0">
        {getCharacterImageUrl() ? (
          <>
            <img
              src={getCharacterImageUrl()}
              alt={characterName}
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            {/* Right-edge blur fade */}
            <div className="absolute top-0 right-0 bottom-0 w-32 backdrop-blur-md" style={{
              maskImage: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 100%)',
              WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 100%)'
            }}></div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-gray-50/40 dark:to-gray-900/60"></div>
            <div className="absolute bottom-0 left-0 right-0 h-40">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
              <div className="absolute bottom-8 left-8 right-8">
                <h2 className="text-3xl font-bold text-white drop-shadow-lg">{characterName}</h2>
                <p className="text-base text-white/60 mt-1">asks you...</p>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <span className="text-9xl font-bold text-white/20">{characterName.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <button onClick={onBack} className="absolute top-4 left-4 p-2 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-lg backdrop-blur-sm transition z-10">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Right panel - Question content */}
      <div className="flex-1 flex flex-col justify-center bg-gradient-to-b from-gray-50 to-cyan-50/50 dark:from-gray-900 dark:to-gray-800 px-12 lg:px-16 relative overflow-hidden">
        <div className="absolute top-10 right-10 w-64 h-64 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-48 h-48 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl"></div>

        <div className="max-w-xl w-full mx-auto relative z-10">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-cyan-100 dark:bg-cyan-900/20 rounded-full mb-4">
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">Icebreaker</span>
            </div>
            <h2 className="text-5xl font-extrabold bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent mb-2">Break the Ice</h2>
            <p className="text-lg text-gray-400 dark:text-gray-500">{characterName} wants to know...</p>
          </div>

          {/* Question card */}
          <div className="p-8 bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-[0_0_30px_rgba(6,182,212,0.08)] mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xl font-medium text-gray-800 dark:text-gray-200 leading-relaxed pt-1.5">{question}</p>
            </div>
          </div>

          {/* Answer input */}
          <div className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden mb-5">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer..."
              className="w-full p-5 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:outline-none text-lg"
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
            <div className="mb-5 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleSkip}
              disabled={skipping}
              className="flex-1 px-6 py-4 bg-gray-200/80 dark:bg-gray-700/60 backdrop-blur-sm text-gray-700 dark:text-gray-300 font-bold text-lg rounded-2xl hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50"
            >
              {skipping ? 'Skipping...' : 'Skip'}
            </button>
            <button
              onClick={handleAnswer}
              disabled={!answer.trim()}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg rounded-2xl hover:opacity-90 transition shadow-lg hover:shadow-xl hover:shadow-cyan-500/20 disabled:opacity-50"
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
