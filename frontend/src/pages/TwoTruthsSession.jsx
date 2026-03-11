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
      <div className="h-full flex flex-col bg-gradient-to-b from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 overflow-y-auto">
        {/* Back button */}
        <div className="flex-shrink-0 px-6 pt-4">
          <button onClick={onBack} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8 pb-8">
          <div className="max-w-lg w-full">
            {/* Character header */}
            <div className="flex items-center gap-4 mb-6">
              {getCharacterImageUrl() ? (
                <img src={getCharacterImageUrl()} alt={characterName} className="w-16 h-16 rounded-full object-cover ring-2 ring-emerald-400 shadow-md" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center ring-2 ring-emerald-400 shadow-md">
                  <span className="text-2xl font-bold text-white">{characterName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">{characterName}</h3>
                <p className="text-sm text-emerald-600 dark:text-emerald-400">Which one is the lie?</p>
              </div>
            </div>

            {/* Statement cards */}
            <div className="space-y-3">
              {statements.map((statement, index) => (
                <button
                  key={index}
                  onClick={() => handleGuess(index)}
                  className="w-full text-left p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md border-2 border-transparent hover:border-emerald-400 dark:hover:border-emerald-500 transition-all hover:shadow-lg group"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center font-bold text-sm group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                      {index + 1}
                    </span>
                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed pt-0.5">{statement}</p>
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
      <div className="h-full flex flex-col bg-gradient-to-b from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 overflow-y-auto">
        {/* Back button */}
        <div className="flex-shrink-0 px-6 pt-4">
          <button onClick={onBack} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8 pb-8">
          <div className="max-w-lg w-full">
            {/* Result header */}
            <div className="text-center mb-6">
              {getCharacterImageUrl() ? (
                <img src={getCharacterImageUrl()} alt={characterName} className="w-20 h-20 rounded-full object-cover ring-4 ring-emerald-400 shadow-lg mx-auto mb-4" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center ring-4 ring-emerald-400 shadow-lg mx-auto mb-4">
                  <span className="text-3xl font-bold text-white">{characterName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <h2 className={`text-2xl font-bold mb-1 ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {isCorrect ? 'You got it!' : 'Not quite!'}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {isCorrect ? 'You spotted the lie!' : `The lie was statement ${lieIndex + 1}`}
              </p>
            </div>

            {/* Revealed statement cards */}
            <div className="space-y-3 mb-6">
              {statements.map((statement, index) => {
                const isLie = index === lieIndex;
                const wasSelected = index === selectedIndex;
                return (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      isLie
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                        : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white ${
                        isLie ? 'bg-red-500' : 'bg-emerald-500'
                      }`}>
                        {isLie ? '\u2717' : '\u2713'}
                      </span>
                      <div className="flex-1">
                        <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{statement}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs font-medium ${isLie ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {isLie ? 'LIE' : 'TRUTH'}
                          </span>
                          {wasSelected && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">&larr; your guess</span>
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
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{characterName}:</span> "{explanation}"
                </p>
              </div>
            )}

            {/* Continue button */}
            <button
              onClick={handleContinueToChat}
              className="w-full px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-full hover:opacity-90 transition shadow-lg hover:shadow-xl"
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
