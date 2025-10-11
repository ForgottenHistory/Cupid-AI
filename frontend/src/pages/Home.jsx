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

  useEffect(() => {
    loadCharacters();
  }, [user?.id]);

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
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
      setCurrentCards(shuffledCharacters);
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
    } catch (error) {
      if (error.response?.status === 429) {
        setShowSwipeLimitModal(true);
        return;
      }
      console.error('Failed to record swipe:', error);
    }

    const swipedCard = currentCards[currentCards.length - 1];

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
        <CardCounter remaining={currentCards.length} total={totalCount} />

        {/* Card Stack */}
        <div className="relative w-full aspect-[3/4] mb-8 overflow-hidden">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white rounded-2xl shadow-2xl">
              <div className="text-center p-8">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading characters...</p>
              </div>
            </div>
          ) : currentCards.length === 0 ? (
            <EmptyCardStack
              totalCount={totalCount}
              onGoToLibrary={() => navigate('/library')}
              onReset={handleReset}
            />
          ) : (
            currentCards.map((character, index) => (
              <SwipeCard
                key={character.id}
                character={character}
                onSwipe={handleSwipe}
                isTop={index === currentCards.length - 1}
                onClick={() => setSelectedCharacter(character)}
              />
            ))
          )}
        </div>

        {/* Action Buttons */}
        {currentCards.length > 0 && (
          <SwipeActionButtons
            onPass={() => handleSwipe('left')}
            onUndo={handleUndo}
            onLike={() => handleSwipe('right')}
            canUndo={removedCards.length > 0}
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
    </div>
  );
};

export default Home;
