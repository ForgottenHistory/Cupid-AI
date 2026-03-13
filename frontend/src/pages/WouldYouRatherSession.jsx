import { useState, useCallback, useMemo } from 'react';
import characterService from '../services/characterService';
import api from '../services/api';
import { getImageUrl } from '../services/api';
import ActivityChatSession from './ActivityChatSession';

function WouldYouRatherSession({ user, onBack }) {
  const [phase, setPhase] = useState('idle');
  const [character, setCharacter] = useState(null);
  const [scenarios, setScenarios] = useState([]);
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

      const response = await api.post('/random-chat/would-you-rather', { characterId: selectedCharacter.id });
      setScenarios(response.data.scenarios);
      setCurrentRound(0);
      setChoices([]);
      setPhase('playing');
    } catch (err) {
      console.error('Failed to load Would You Rather:', err);
      setError(err.message || 'Failed to start game');
      setPhase('idle');
    }
  }, [user]);

  const handleChoice = useCallback((option) => {
    setChoices(prev => [...prev, option]);
    if (currentRound + 1 >= scenarios.length) {
      setPhase('summary');
    } else {
      setCurrentRound(r => r + 1);
    }
  }, [currentRound, scenarios.length]);

  const handleContinueToChat = useCallback(() => {
    setPhase('chatting');
  }, []);

  const activityContext = useMemo(() => {
    if (scenarios.length === 0 || choices.length === 0) return '';
    const summary = scenarios.map((s, i) => `"${s.optionA}" vs "${s.optionB}": they chose "${choices[i]}"`).join(', ');
    return `You just played "Would You Rather" with them! Here are the dilemmas and their choices: ${summary}. React to their choices - discuss the ones you find most interesting, agree or disagree, and be curious about why they picked what they did!`;
  }, [scenarios, choices]);

  if (phase === 'chatting') {
    return (
      <ActivityChatSession
        user={user}
        mode="would-you-rather"
        onBack={onBack}
        initialCharacter={character}
        activityContext={activityContext}
      />
    );
  }

  if (phase === 'loading') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-violet-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-violet-500 border-t-transparent"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Setting up the game...</p>
      </div>
    );
  }

  if (phase === 'playing' && scenarios.length > 0) {
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
            <div className="w-full h-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
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
        <div className="flex-1 flex flex-col justify-center bg-gradient-to-b from-gray-50 to-violet-50/50 dark:from-gray-900 dark:to-gray-800 px-12 lg:px-16 relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute top-10 right-10 w-64 h-64 bg-violet-500/5 dark:bg-violet-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 left-10 w-48 h-48 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl"></div>

          <div className="max-w-xl w-full mx-auto relative z-10">
            {/* Round indicator */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-violet-100 dark:bg-violet-900/20 rounded-full mb-4">
                <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">Round {currentRound + 1} of {scenarios.length}</span>
              </div>
              <h2 className="text-5xl font-extrabold bg-gradient-to-r from-violet-500 to-purple-500 bg-clip-text text-transparent mb-2">Would You Rather?</h2>
              <p className="text-lg text-gray-400 dark:text-gray-500">{characterName} wants to know...</p>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-gray-200 dark:bg-gray-700/50 rounded-full overflow-hidden mb-10">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500 ease-out rounded-full"
                style={{ width: `${((currentRound) / scenarios.length) * 100}%` }}
              />
            </div>

            {/* Option A */}
            <button
              onClick={() => handleChoice(scenarios[currentRound].optionA)}
              className="group w-full p-8 bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 hover:border-violet-400 dark:hover:border-violet-500 transition-all duration-200 hover:shadow-[0_0_30px_rgba(139,92,246,0.15)] hover:scale-[1.02] active:scale-[0.98] mb-5"
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:scale-110 transition-transform">
                  <span className="text-white font-bold text-lg">A</span>
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{scenarios[currentRound].optionA}</p>
              </div>
            </button>

            {/* OR divider */}
            <div className="flex items-center gap-4 mb-5">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-300/40 to-transparent dark:via-violet-500/20"></div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <span className="text-white text-sm font-extrabold tracking-wider">OR</span>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-300/40 to-transparent dark:via-purple-500/20"></div>
            </div>

            {/* Option B */}
            <button
              onClick={() => handleChoice(scenarios[currentRound].optionB)}
              className="group w-full p-8 bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 hover:border-purple-400 dark:hover:border-purple-500 transition-all duration-200 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                  <span className="text-white font-bold text-lg">B</span>
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{scenarios[currentRound].optionB}</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'summary') {
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
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <span className="text-9xl font-bold text-white/20">{characterName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <button onClick={onBack} className="absolute top-4 left-4 p-2 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-lg backdrop-blur-sm transition z-10">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Right panel - Summary */}
        <div className="flex-1 flex flex-col justify-center bg-gradient-to-b from-gray-50 to-violet-50/50 dark:from-gray-900 dark:to-gray-800 px-12 lg:px-16 relative overflow-hidden overflow-y-auto">
          <div className="absolute top-10 right-10 w-64 h-64 bg-violet-500/5 dark:bg-violet-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 left-10 w-48 h-48 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl"></div>

          <div className="max-w-xl w-full mx-auto relative z-10 py-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-violet-100 dark:bg-violet-900/20 rounded-full mb-4">
                <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">Results</span>
              </div>
              <h2 className="text-4xl font-extrabold bg-gradient-to-r from-violet-500 to-purple-500 bg-clip-text text-transparent mb-2">Your Choices</h2>
              <p className="text-lg text-gray-400 dark:text-gray-500">Let's see what {characterName} thinks!</p>
            </div>

            {/* Results list */}
            <div className="space-y-3 mb-8">
              {scenarios.map((scenario, index) => (
                <div key={index} className="p-4 bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                      <span className="text-white font-bold text-xs">{index + 1}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2 text-sm">
                      <span className={choices[index] === scenario.optionA ? 'font-bold text-violet-600 dark:text-violet-400' : 'text-gray-400 dark:text-gray-500'}>
                        {scenario.optionA}
                      </span>
                      <span className="text-gray-300 dark:text-gray-600">vs</span>
                      <span className={choices[index] === scenario.optionB ? 'font-bold text-violet-600 dark:text-violet-400' : 'text-gray-400 dark:text-gray-500'}>
                        {scenario.optionB}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Continue button */}
            <button
              onClick={handleContinueToChat}
              className="w-full px-8 py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-lg rounded-2xl hover:opacity-90 transition shadow-lg hover:shadow-xl hover:shadow-violet-500/20"
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

        <div className="w-24 h-24 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Would You Rather</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Fun dilemmas that reveal your personality! Pick between two scenarios, then chat about your choices.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button onClick={loadGame} className="px-8 py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-full hover:opacity-90 transition shadow-lg hover:shadow-xl">
          Start Game
        </button>
      </div>
    </div>
  );
}

export default WouldYouRatherSession;
