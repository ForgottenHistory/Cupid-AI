import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import characterService from '../services/characterService';
import chatService from '../services/chatService';
import CharacterProfile from '../components/CharacterProfile';
import SwipeLimitModal from '../components/SwipeLimitModal';
import SwipeCard from '../components/home/SwipeCard';
import MatchModal from '../components/home/MatchModal';
import CardCounter from '../components/home/CardCounter';
import EmptyCardStack from '../components/home/EmptyCardStack';
import SwipeActionButtons from '../components/home/SwipeActionButtons';
import { getCurrentStatusFromSchedule } from '../utils/characterHelpers';
import api from '../services/api';

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentCards, setCurrentCards] = useState([]);
  const [removedCards, setRemovedCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [matchedCharacter, setMatchedCharacter] = useState(null);
  const [showSwipeLimitModal, setShowSwipeLimitModal] = useState(false);
  const [maxMatchesError, setMaxMatchesError] = useState(null);
  const [swipeStats, setSwipeStats] = useState({ used: 0, limit: 5 });
  const [timeUntilReset, setTimeUntilReset] = useState('');

  // Check if swipes are exhausted
  const isSwipesExhausted = swipeStats.limit > 0 && swipeStats.used >= swipeStats.limit;

  // Calculate time until midnight reset
  useEffect(() => {
    if (!isSwipesExhausted) {
      setTimeUntilReset('');
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight - now;

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeUntilReset(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isSwipesExhausted]);

  // Get today's date key for localStorage
  const getTodayKey = () => {
    const today = new Date().toISOString().split('T')[0];
    return `swipedCharacters-${user?.id}-${today}`;
  };

  // Get swiped character IDs for today from localStorage
  const getSwipedToday = () => {
    try {
      const data = localStorage.getItem(getTodayKey());
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };

  // Add a character ID to today's swiped list
  const addSwipedToday = (characterId) => {
    const swiped = getSwipedToday();
    if (!swiped.includes(characterId)) {
      swiped.push(characterId);
      localStorage.setItem(getTodayKey(), JSON.stringify(swiped));
    }
  };

  // Remove a character ID from today's swiped list (for undo)
  const removeSwipedToday = (characterId) => {
    const swiped = getSwipedToday();
    const filtered = swiped.filter(id => id !== characterId);
    localStorage.setItem(getTodayKey(), JSON.stringify(filtered));
  };

  useEffect(() => {
    const init = async () => {
      await loadSwipeStats();
      loadCharacters();
    };
    init();
  }, [user?.id]);

  const loadSwipeStats = async () => {
    try {
      const response = await api.get('/characters/swipe-limit');
      const stats = { used: response.data.used, limit: response.data.limit };
      setSwipeStats(stats);
      return stats;
    } catch (error) {
      console.error('Failed to load swipe stats:', error);
      return null;
    }
  };

  // Seeded random number generator (mulberry32)
  const seededRandom = (seed) => {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Create a daily seed from date + user ID
  const getDailySeed = () => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const seedString = `${today}-${user?.id || 'default'}`;
    // Simple string hash
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      const char = seedString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash;
  };

  const shuffleArray = (array) => {
    const shuffled = [...array];
    const rng = seededRandom(getDailySeed());
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const loadCharacters = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const characters = await characterService.getSwipeableCharacters(user.id);
      const shuffledCharacters = shuffleArray(characters);
      // Filter out characters swiped today (tracked in localStorage)
      const swipedToday = getSwipedToday();
      const remainingCharacters = shuffledCharacters.filter(c => !swipedToday.includes(c.id));
      setCurrentCards(remainingCharacters);
      setTotalCount(shuffledCharacters.length);
    } catch (error) {
      console.error('Failed to load characters:', error);
      alert('Failed to load characters. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (direction) => {
    if (currentCards.length === 0) return;

    // Check swipe limit before allowing swipe
    try {
      const response = await api.post('/characters/swipe');
      if (!response.data.success) {
        setShowSwipeLimitModal(true);
        return;
      }
      // Update swipe stats after successful swipe
      setSwipeStats(prev => ({ ...prev, used: prev.used + 1 }));
    } catch (error) {
      if (error.response?.status === 429) {
        setShowSwipeLimitModal(true);
        return;
      }
      console.error('Failed to record swipe:', error);
    }

    const swipedCard = currentCards[currentCards.length - 1];

    // Track this character as swiped today (for persistent order on refresh)
    addSwipedToday(swipedCard.id);

    // Save like to database if swiped right
    if (direction === 'right') {
      try {
        await characterService.likeCharacter(swipedCard.id);

        // No immediate first message - let proactive system handle it naturally
        // This creates more organic timing for first messages based on character availability and personality

        // Show match animation
        setMatchedCharacter(swipedCard);

        // Notify other components to refresh
        window.dispatchEvent(new Event('characterUpdated'));
      } catch (error) {
        console.error('Failed to like character:', error);

        // Check if it's a max matches error
        if (error.message && error.message.includes('Maximum matches')) {
          setMaxMatchesError(error.message);
          // Don't remove the card, just return
          return;
        }
      }
    }

    setRemovedCards([...removedCards, { ...swipedCard, direction }]);

    setTimeout(() => {
      setCurrentCards(currentCards.slice(0, -1));
    }, 300);
  };

  const handleUndo = async () => {
    if (removedCards.length === 0) return;

    const lastRemoved = removedCards[removedCards.length - 1];

    // Remove from today's swiped list
    removeSwipedToday(lastRemoved.id);

    // If it was liked, unlike it
    if (lastRemoved.direction === 'right') {
      try {
        await characterService.unlikeCharacter(lastRemoved.id);
        // Notify other components to refresh
        window.dispatchEvent(new Event('characterUpdated'));
      } catch (error) {
        console.error('Failed to unlike character:', error);
      }
    }

    setCurrentCards([...currentCards, lastRemoved]);
    setRemovedCards(removedCards.slice(0, -1));
  };

  const handleReset = async () => {
    await loadCharacters();
    setRemovedCards([]);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 overflow-hidden">
      <div className="w-full max-w-md">
        <CardCounter remaining={currentCards.length} total={totalCount} swipesUsed={swipeStats.used} swipeLimit={swipeStats.limit} />

        {/* Card Stack */}
        <div className="relative w-full aspect-[3/4] mb-8 overflow-hidden">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 rounded-2xl shadow-2xl">
              <div className="text-center p-8">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-300">Loading characters...</p>
              </div>
            </div>
          ) : currentCards.length === 0 ? (
            <EmptyCardStack
              totalCount={totalCount}
              onGoToLibrary={() => navigate('/library')}
              onReset={handleReset}
            />
          ) : (
            <>
              {currentCards.map((character, index) => (
                <SwipeCard
                  key={character.id}
                  character={character}
                  onSwipe={isSwipesExhausted ? () => {} : handleSwipe}
                  isTop={index === currentCards.length - 1}
                  onClick={() => !isSwipesExhausted && setSelectedCharacter(character)}
                />
              ))}
              {/* Locked overlay when swipes exhausted */}
              {isSwipesExhausted && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-10">
                  <div className="text-6xl mb-4">🔒</div>
                  <h3 className="text-2xl font-bold text-white mb-2">Out of Swipes</h3>
                  <p className="text-white/80 mb-4">Resets in</p>
                  <div className="bg-white/20 rounded-xl px-6 py-3">
                    <span className="text-3xl font-mono font-bold text-white">{timeUntilReset}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        {currentCards.length > 0 && (
          <SwipeActionButtons
            onPass={() => handleSwipe('left')}
            onUndo={handleUndo}
            onLike={() => handleSwipe('right')}
            canUndo={removedCards.length > 0}
            disabled={isSwipesExhausted}
          />
        )}
      </div>

      {/* Character Profile Modal */}
      {selectedCharacter && (
        <CharacterProfile
          character={selectedCharacter}
          onClose={() => setSelectedCharacter(null)}
          mode="discover"
          onLike={() => {
            handleSwipe('right');
            setSelectedCharacter(null);
          }}
          onPass={() => {
            handleSwipe('left');
            setSelectedCharacter(null);
          }}
          onUpdate={async () => {
            // Reload the updated character from storage
            const updatedChar = await characterService.getCharacter(selectedCharacter.id);
            setSelectedCharacter(updatedChar);
            // Also update it in the current cards
            setCurrentCards(currentCards.map(c =>
              c.id === updatedChar.id ? updatedChar : c
            ));
          }}
        />
      )}

      {/* Match Animation */}
      {matchedCharacter && (
        <MatchModal
          character={matchedCharacter}
          onClose={() => setMatchedCharacter(null)}
        />
      )}

      {/* Swipe Limit Modal */}
      {showSwipeLimitModal && (
        <SwipeLimitModal
          onClose={() => setShowSwipeLimitModal(false)}
        />
      )}

      {/* Max Matches Error Modal */}
      {maxMatchesError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Max Matches Reached
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {maxMatchesError}
              </p>
              <button
                onClick={() => setMaxMatchesError(null)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
