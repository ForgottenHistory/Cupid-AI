import { useState, useCallback, useMemo } from 'react';
import characterService from '../services/characterService';
import api from '../services/api';
import { getImageUrl } from '../services/api';
import ActivityChatSession from './ActivityChatSession';

function TwoTruthsSession({ user, onBack }) {
  const [phase, setPhase] = useState('idle');
  const [character, setCharacter] = useState(null);
  const [statements, setStatements] = useState([]);
  const [lieIndex, setLieIndex] = useState(null);
  const [explanation, setExplanation] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [error, setError] = useState(null);

  const getCharacterImageUrl = useCallback(() => {
    const imgUrl = character?.imageUrl || character?.image_url;
    if (!imgUrl) return null;
    if (imgUrl.startsWith('data:')) return imgUrl;
    return getImageUrl(imgUrl);
  }, [character]);

  const characterName = character?.cardData?.data?.name || character?.cardData?.name || character?.name || 'Character';

  const isCorrect = selectedIndex === lieIndex;

  const loadGame = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const settingsRes = await api.get('/users/activities-settings');
      const settings = settingsRes.data;
      const selectedCharacter = await characterService.getRandomOnlineCharacter(user.id, settings.activitiesIncludeAway, settings.activitiesIncludeBusy);
      if (!selectedCharacter) {
        setError('No characters are currently online. Try again later!');
        setPhase('idle');
        return;
      }
      setCharacter(selectedCharacter);
      const response = await api.post('/random-chat/two-truths', { characterId: selectedCharacter.id });
      setStatements(response.data.statements);
      setLieIndex(response.data.lieIndex);
      setExplanation(response.data.explanation);
      setPhase('guessing');
    } catch (err) {
      console.error('Failed to load two truths game:', err);
      setError(err.response?.data?.error || 'Failed to start the game. Please try again.');
      setPhase('idle');
    }
  }, [user]);

  const handleGuess = (index) => {
    setSelectedIndex(index);
    setPhase('result');
  };

  const handleContinueToChat = () => {
    setPhase('chatting');
  };

  const activityContext = useMemo(() => {
    if (selectedIndex === null || lieIndex === null || statements.length === 0) return '';
    if (selectedIndex === lieIndex) {
      return `They correctly spotted your lie! The lie was: '${statements[lieIndex]}'. They're pretty perceptive!`;
    }
    return `They fell for your lie! They thought '${statements[selectedIndex]}' was the lie, but it was actually '${statements[lieIndex]}'.`;
  }, [selectedIndex, lieIndex, statements]);

  if (phase === 'chatting') {
    return (
      <ActivityChatSession
        user={user}
        mode="two-truths"
        onBack={onBack}
        initialCharacter={character}
        activityContext={activityContext}
      />
    );
  }

  if (phase === 'loading') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Finding someone for you...</p>
      </div>
    );
  }

  if (phase === 'guessing') {
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
                  <p className="text-base text-white/60 mt-1">says...</p>
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <span className="text-9xl font-bold text-white/20">{characterName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <button onClick={onBack} className="absolute top-4 left-4 p-2 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-lg backdrop-blur-sm transition z-10">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Right panel - Game content */}
        <div className="flex-1 flex flex-col justify-center bg-gradient-to-b from-gray-50 to-emerald-50/50 dark:from-gray-900 dark:to-gray-800 px-12 lg:px-16 relative overflow-hidden">
          <div className="absolute top-10 right-10 w-64 h-64 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 left-10 w-48 h-48 bg-teal-500/5 dark:bg-teal-500/10 rounded-full blur-3xl"></div>

          <div className="max-w-xl w-full mx-auto relative z-10">
            {/* Title */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-100 dark:bg-emerald-900/20 rounded-full mb-4">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Spot the lie</span>
              </div>
              <h2 className="text-5xl font-extrabold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent mb-2">Two Truths & A Lie</h2>
              <p className="text-lg text-gray-400 dark:text-gray-500">Which statement is {characterName} making up?</p>
            </div>

            {/* Statement cards */}
            <div className="space-y-4">
              {statements.map((statement, index) => (
                <button
                  key={index}
                  onClick={() => handleGuess(index)}
                  className="group w-full text-left p-6 bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 hover:border-emerald-400 dark:hover:border-emerald-500 transition-all duration-200 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                      <span className="text-white font-bold text-lg">{index + 1}</span>
                    </div>
                    <p className="text-lg font-medium text-gray-800 dark:text-gray-200 leading-relaxed pt-1.5 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{statement}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'result') {
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
            <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <span className="text-9xl font-bold text-white/20">{characterName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <button onClick={onBack} className="absolute top-4 left-4 p-2 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-lg backdrop-blur-sm transition z-10">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Right panel - Results */}
        <div className="flex-1 flex flex-col justify-center bg-gradient-to-b from-gray-50 to-emerald-50/50 dark:from-gray-900 dark:to-gray-800 px-12 lg:px-16 relative overflow-hidden">
          <div className="absolute top-10 right-10 w-64 h-64 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 left-10 w-48 h-48 bg-teal-500/5 dark:bg-teal-500/10 rounded-full blur-3xl"></div>

          <div className="max-w-xl w-full mx-auto relative z-10">
            {/* Result header */}
            <div className="text-center mb-8">
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 ${isCorrect ? 'bg-emerald-100 dark:bg-emerald-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                <span className={`text-xs font-bold uppercase tracking-widest ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  {isCorrect ? 'Correct!' : 'Wrong guess'}
                </span>
              </div>
              <h2 className={`text-5xl font-extrabold bg-clip-text text-transparent mb-2 ${isCorrect ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-red-500 to-orange-500'}`}>
                {isCorrect ? 'You got it!' : 'Not quite!'}
              </h2>
              <p className="text-lg text-gray-400 dark:text-gray-500">
                {isCorrect ? 'You spotted the lie!' : `The lie was statement ${lieIndex + 1}`}
              </p>
            </div>

            {/* Revealed statement cards */}
            <div className="space-y-4 mb-8">
              {statements.map((statement, index) => {
                const isLie = index === lieIndex;
                const wasSelected = index === selectedIndex;
                return (
                  <div
                    key={index}
                    className={`p-5 rounded-2xl border backdrop-blur-sm transition-all ${
                      isLie
                        ? 'bg-red-50/80 dark:bg-red-900/20 border-red-300/50 dark:border-red-700/50'
                        : 'bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-300/50 dark:border-emerald-700/50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg ${
                        isLie ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/20' : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20'
                      }`}>
                        {isLie ? '\u2717' : '\u2713'}
                      </div>
                      <div className="flex-1">
                        <p className="text-base font-medium text-gray-800 dark:text-gray-200 leading-relaxed">{statement}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-xs font-bold uppercase tracking-wider ${isLie ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {isLie ? 'Lie' : 'Truth'}
                          </span>
                          {wasSelected && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 italic">&larr; your guess</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Explanation */}
            {explanation && (
              <div className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-200/50 dark:border-gray-700/50 mb-8">
                <p className="text-base text-gray-600 dark:text-gray-400">
                  <span className="font-bold text-gray-800 dark:text-gray-200">{characterName}:</span> &ldquo;{explanation}&rdquo;
                </p>
              </div>
            )}

            {/* Continue button */}
            <button
              onClick={handleContinueToChat}
              className="w-full px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-lg rounded-2xl hover:opacity-90 transition shadow-lg hover:shadow-xl hover:shadow-emerald-500/20"
            >
              Continue to Chat &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  }

  // IDLE phase (default)
  return (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="text-center max-w-md">
        <button onClick={onBack} className="absolute top-4 left-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          {/* Numbered list icon */}
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Two Truths & A Lie</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          A character tells you three things about themselves. Two are true, one is a lie. Can you spot it? Then chat for 10 minutes!
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          onClick={loadGame}
          className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-full hover:opacity-90 transition shadow-lg hover:shadow-xl"
        >
          Start Game
        </button>
      </div>
    </div>
  );
}

export default TwoTruthsSession;
