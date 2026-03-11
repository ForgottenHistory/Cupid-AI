import { useState, useCallback, useMemo } from 'react';
import characterService from '../services/characterService';
import api from '../services/api';
import { getImageUrl } from '../services/api';
import ActivityChatSession from './ActivityChatSession';

function ThisOrThatSession({ user, onBack }) {
  const [phase, setPhase] = useState('idle');
  const [character, setCharacter] = useState(null);
  const [pairs, setPairs] = useState([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [choices, setChoices] = useState([]);
  const [error, setError] = useState(null);

  const characterName = character?.cardData?.data?.name || character?.cardData?.name || character?.name || 'Character';

  const getCharacterImageUrl = useCallback(() => {
    const imgUrl = character?.imageUrl || character?.image_url;
    if (!imgUrl) return null;
    if (imgUrl.startsWith('data:')) return imgUrl;
    return getImageUrl(imgUrl);
  }, [character]);

  const loadGame = useCallback(async () => {
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
        throw new Error('No characters available. Make sure you have unmatched characters with schedules that are currently online.');
      }

      setCharacter(selectedCharacter);

      const response = await api.post('/random-chat/this-or-that', { characterId: selectedCharacter.id });
      setPairs(response.data.pairs);
      setCurrentRound(0);
      setChoices([]);
      setPhase('playing');
    } catch (err) {
      console.error('Failed to load This or That:', err);
      setError(err.message || 'Failed to start game');
      setPhase('idle');
    }
  }, [user]);

  const handleChoice = useCallback((option) => {
    setChoices(prev => [...prev, option]);
    if (currentRound + 1 >= pairs.length) {
      setPhase('summary');
    } else {
      setCurrentRound(r => r + 1);
    }
  }, [currentRound, pairs.length]);

  const handleContinueToChat = useCallback(() => {
    setPhase('chatting');
  }, []);

  const activityContext = useMemo(() => {
    if (pairs.length === 0 || choices.length === 0) return '';
    const summary = pairs.map((pair, i) => `${pair.optionA} vs ${pair.optionB}: they chose "${choices[i]}"`).join(', ');
    return `You just played "This or That" with them! Here's what they picked: ${summary}. React to their choices - find things you have in common or playfully disagree with. Be fun and engaging!`;
  }, [pairs, choices]);

  if (phase === 'chatting') {
    return (
      <ActivityChatSession
        user={user}
        mode="this-or-that"
        onBack={onBack}
        initialCharacter={character}
        activityContext={activityContext}
      />
    );
  }

  if (phase === 'loading') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Setting up the game...</p>
      </div>
    );
  }

  if (phase === 'playing' && pairs.length > 0) {
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
              {/* Gradient overlay on right edge for blend */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-gray-900/80"></div>
              {/* Bottom gradient for name */}
              <div className="absolute bottom-0 left-0 right-0 h-40">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                <div className="absolute bottom-8 left-8 right-8">
                  <h2 className="text-3xl font-bold text-white drop-shadow-lg">{characterName}</h2>
                  <p className="text-base text-white/60 mt-1">asks you...</p>
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
              <span className="text-9xl font-bold text-white/20">{characterName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          {/* Back button overlaid on image */}
          <button onClick={onBack} className="absolute top-4 left-4 p-2 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-lg backdrop-blur-sm transition z-10">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Right panel - Game content */}
        <div className="flex-1 flex flex-col justify-center bg-gradient-to-b from-gray-50 to-orange-50/50 dark:from-gray-900 dark:to-gray-800 px-12 lg:px-16 relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute top-10 right-10 w-64 h-64 bg-orange-500/5 dark:bg-orange-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 left-10 w-48 h-48 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-3xl"></div>

          <div className="max-w-xl w-full mx-auto relative z-10">
            {/* Round indicator */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-100 dark:bg-orange-900/20 rounded-full mb-4">
                <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">Round {currentRound + 1} of {pairs.length}</span>
              </div>
              <h2 className="text-5xl font-extrabold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent mb-2">This or That?</h2>
              <p className="text-lg text-gray-400 dark:text-gray-500">{characterName} wants to know...</p>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-gray-200 dark:bg-gray-700/50 rounded-full overflow-hidden mb-10">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500 ease-out rounded-full"
                style={{ width: `${((currentRound) / pairs.length) * 100}%` }}
              />
            </div>

            {/* Option A */}
            <button
              onClick={() => handleChoice(pairs[currentRound].optionA)}
              className="group w-full p-8 bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 hover:border-orange-400 dark:hover:border-orange-500 transition-all duration-200 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)] hover:scale-[1.02] active:scale-[0.98] mb-5"
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                  <span className="text-white font-bold text-lg">A</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{pairs[currentRound].optionA}</p>
              </div>
            </button>

            {/* OR divider */}
            <div className="flex items-center gap-4 mb-5">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-300/40 to-transparent dark:via-orange-500/20"></div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <span className="text-white text-sm font-extrabold tracking-wider">OR</span>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent dark:via-amber-500/20"></div>
            </div>

            {/* Option B */}
            <button
              onClick={() => handleChoice(pairs[currentRound].optionB)}
              className="group w-full p-8 bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 hover:border-amber-400 dark:hover:border-amber-500 transition-all duration-200 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform">
                  <span className="text-white font-bold text-lg">B</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{pairs[currentRound].optionB}</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'summary') {
    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800 overflow-y-auto">
        <div className="flex-shrink-0 px-6 pt-4">
          <button onClick={onBack} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8 pb-8">
          <div className="max-w-lg w-full">
            {/* Header */}
            <div className="text-center mb-6">
              {getCharacterImageUrl() ? (
                <img src={getCharacterImageUrl()} alt={characterName} className="w-20 h-20 rounded-full object-cover ring-4 ring-orange-400 shadow-lg mx-auto mb-4" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center ring-4 ring-orange-400 shadow-lg mx-auto mb-4">
                  <span className="text-3xl font-bold text-white">{characterName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Your Picks</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Let's see what {characterName} thinks!</p>
            </div>

            {/* Results list */}
            <div className="space-y-2 mb-6">
              {pairs.map((pair, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <span className="flex-shrink-0 w-7 h-7 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center font-bold text-xs">
                    {index + 1}
                  </span>
                  <div className="flex-1 flex items-center gap-2 text-sm">
                    <span className={choices[index] === pair.optionA ? 'font-bold text-orange-600 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500'}>
                      {pair.optionA}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">vs</span>
                    <span className={choices[index] === pair.optionB ? 'font-bold text-orange-600 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500'}>
                      {pair.optionB}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Continue button */}
            <button
              onClick={handleContinueToChat}
              className="w-full px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-semibold rounded-full hover:opacity-90 transition shadow-lg hover:shadow-xl"
            >
              Continue to Chat &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  }

  // IDLE phase
  return (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="text-center max-w-md">
        <button onClick={onBack} className="absolute top-4 left-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          {/* Swap/arrows icon */}
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">This or That</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Quick-fire preference questions! Pick your favorites, then chat about your choices.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button onClick={loadGame} className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-semibold rounded-full hover:opacity-90 transition shadow-lg hover:shadow-xl">
          Start Game
        </button>
      </div>
    </div>
  );
}

export default ThisOrThatSession;
