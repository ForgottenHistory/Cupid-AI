import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import characterService from '../services/characterService';
import chatService from '../services/chatService';
import CharacterProfile from '../components/CharacterProfile';

function SwipeCard({ character, onSwipe, isTop, programmaticSwipe, onClick }) {
  const [dragStart, setDragStart] = useState(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState(null);
  const cardRef = useRef(null);

  const handleDragStart = (e) => {
    const clientX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
    const clientY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
    setDragStart({ x: clientX, y: clientY });
    setIsDragging(true);
  };

  const handleDragMove = (e) => {
    if (!dragStart || !isTop || isExiting) return;

    const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
    const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;

    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;

    setDragPosition({ x: deltaX, y: deltaY });
  };

  const handleDragEnd = (isClick = false) => {
    if (!isTop || isExiting) return;

    const swipeThreshold = 100;
    const clickThreshold = 20; // Increased to 20px for more forgiving click detection

    if (Math.abs(dragPosition.x) > swipeThreshold) {
      const direction = dragPosition.x > 0 ? 'right' : 'left';
      setIsExiting(true);
      setExitDirection(direction);
      setTimeout(() => {
        onSwipe(direction);
      }, 300);
    } else {
      // Check if this was a click (minimal movement) - only on actual click/mouseup, not on mouse leave
      if (isClick && Math.abs(dragPosition.x) < clickThreshold && Math.abs(dragPosition.y) < clickThreshold && onClick) {
        onClick();
      }
      setDragStart(null);
      setDragPosition({ x: 0, y: 0 });
      setIsDragging(false);
    }
  };

  const handleMouseLeave = () => {
    // Just reset the drag state without triggering click
    if (!isTop || isExiting) return;
    setDragStart(null);
    setDragPosition({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const rotation = isExiting ? (exitDirection === 'right' ? 30 : -30) : dragPosition.x / 10;
  const translateX = isExiting ? (exitDirection === 'right' ? 1000 : -1000) : dragPosition.x;
  const opacity = isExiting ? 0 : (isTop ? 1 - Math.abs(dragPosition.x) / 500 : 1);

  return (
    <div
      ref={cardRef}
      className={`absolute w-full h-full select-none ${
        isTop && isDragging ? 'cursor-grabbing' : 'cursor-pointer'
      }`}
      style={{
        transform: `translate(${translateX}px, ${dragPosition.y}px) rotate(${rotation}deg)`,
        opacity: opacity,
        transition: (isDragging && !isExiting) ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
      }}
      onMouseDown={isTop ? handleDragStart : undefined}
      onMouseMove={isTop ? handleDragMove : undefined}
      onMouseUp={isTop ? () => handleDragEnd(true) : undefined}
      onMouseLeave={isTop ? handleMouseLeave : undefined}
      onTouchStart={isTop ? handleDragStart : undefined}
      onTouchMove={isTop ? handleDragMove : undefined}
      onTouchEnd={isTop ? () => handleDragEnd(true) : undefined}
    >
      <div className="relative w-full h-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <img
          src={character.imageUrl}
          alt={character.name}
          className="w-full h-full object-cover"
          draggable="false"
        />

        {isTop && (
          <>
            <div
              className="absolute top-8 left-8 text-6xl font-bold text-green-500 border-4 border-green-500 px-4 py-2 rotate-[-20deg] transition-opacity"
              style={{ opacity: Math.max(0, dragPosition.x / 150) }}
            >
              LIKE
            </div>
            <div
              className="absolute top-8 right-8 text-6xl font-bold text-red-500 border-4 border-red-500 px-4 py-2 rotate-[20deg] transition-opacity"
              style={{ opacity: Math.max(0, -dragPosition.x / 150) }}
            >
              NOPE
            </div>
          </>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h2 className="text-white text-3xl font-bold">{character.name}</h2>
              {character.cardData?.data?.datingProfile?.age && (
                <p className="text-white/80 text-lg mt-1">{character.cardData.data.datingProfile.age}</p>
              )}
            </div>
            <div className="ml-3 bg-white/20 backdrop-blur-sm rounded-full p-2 hover:bg-white/30 transition">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          {(character.cardData?.data?.datingProfile?.bio || character.cardData?.data?.description) && (
            <p className="text-white/90 text-sm mt-2 line-clamp-2">
              {character.cardData.data.datingProfile?.bio || character.cardData.data.description}
            </p>
          )}
          {character.cardData?.data?.datingProfile?.interests && character.cardData.data.datingProfile.interests.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {character.cardData.data.datingProfile.interests.slice(0, 3).map((interest, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full text-xs font-medium border border-white/30"
                >
                  {interest}
                </span>
              ))}
              {character.cardData.data.datingProfile.interests.length > 3 && (
                <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full text-xs font-medium border border-white/30">
                  +{character.cardData.data.datingProfile.interests.length - 3} more
                </span>
              )}
            </div>
          )}
          <div className="mt-3 text-white/60 text-xs flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            Click for details
          </div>
        </div>
      </div>
    </div>
  );
}

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentCards, setCurrentCards] = useState([]);
  const [removedCards, setRemovedCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [matchedCharacter, setMatchedCharacter] = useState(null);

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

    const swipedCard = currentCards[currentCards.length - 1];

    // Save like to database if swiped right
    if (direction === 'right') {
      try {
        await characterService.likeCharacter(swipedCard.id);

        // 50/50 chance for AI to send first message on match
        if (Math.random() < 0.5) {
          try {
            await chatService.generateFirstMessage(swipedCard.id, swipedCard.cardData.data);
          } catch (err) {
            console.error('Failed to generate first message:', err);
            // Continue even if first message fails
          }
        }

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
        {totalCount > 0 && currentCards.length > 0 && (
          <div className="text-center mb-6">
            <div className="text-sm text-gray-500 font-medium">
              {currentCards.length} / {totalCount} remaining
            </div>
          </div>
        )}

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
            <div className="absolute inset-0 flex items-center justify-center bg-white rounded-2xl shadow-2xl">
              <div className="text-center p-8">
                {totalCount === 0 ? (
                  <>
                    <svg
                      className="w-24 h-24 mx-auto text-gray-300 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="text-2xl text-gray-400 mb-2">No characters yet!</p>
                    <p className="text-gray-500 mb-4">Upload some character cards to start swiping</p>
                    <button
                      onClick={() => navigate('/library')}
                      className="bg-purple-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-purple-600 transition-colors"
                    >
                      Go to Library
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-2xl text-gray-400 mb-4">All done!</p>
                    <p className="text-gray-500 mb-4">You've swiped through all characters</p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={handleReset}
                        className="bg-purple-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-purple-600 transition-colors"
                      >
                        Reload
                      </button>
                      <button
                        onClick={() => navigate('/library')}
                        className="bg-blue-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-600 transition-colors"
                      >
                        Library
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
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
          <div className="flex justify-center gap-6">
            <button
              onClick={() => handleSwipe('left')}
              className="bg-red-500 text-white w-16 h-16 rounded-full shadow-lg hover:bg-red-600 transition-all hover:scale-110 flex items-center justify-center"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <button
              onClick={handleUndo}
              disabled={removedCards.length === 0}
              className="bg-yellow-500 text-white w-16 h-16 rounded-full shadow-lg hover:bg-yellow-600 transition-all hover:scale-110 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>

            <button
              onClick={() => handleSwipe('right')}
              className="bg-green-500 text-white w-16 h-16 rounded-full shadow-lg hover:bg-green-600 transition-all hover:scale-110 flex items-center justify-center"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setMatchedCharacter(null)}
        >
          <div className="relative animate-scale-up">
            {/* Floating Hearts */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute animate-float-heart"
                  style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 0.5}s`,
                    animationDuration: `${2 + Math.random() * 2}s`,
                  }}
                >
                  <svg className="w-8 h-8 text-pink-400 opacity-70" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                </div>
              ))}
            </div>

            {/* Match Content */}
            <div className="relative bg-gradient-to-br from-pink-500 via-purple-600 to-pink-600 p-8 rounded-3xl shadow-2xl max-w-md">
              <div className="text-center mb-6">
                <h2 className="text-6xl font-black text-white mb-2 tracking-wider animate-pulse-slow">
                  IT'S A MATCH!
                </h2>
                <p className="text-white/90 text-lg">
                  You and {matchedCharacter.name} liked each other
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/30">
                <div className="flex items-center gap-4">
                  <img
                    src={matchedCharacter.imageUrl}
                    alt={matchedCharacter.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                  <div className="flex-1 text-white">
                    <h3 className="text-2xl font-bold">{matchedCharacter.name}</h3>
                    {matchedCharacter.cardData?.data?.datingProfile?.age && (
                      <p className="text-white/80 text-lg">{matchedCharacter.cardData.data.datingProfile.age}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/chat/${matchedCharacter.id}`);
                  }}
                  className="flex-1 bg-white text-purple-600 font-bold py-3 px-6 rounded-full hover:bg-purple-50 transition-all hover:scale-105 shadow-lg"
                >
                  Send Message
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMatchedCharacter(null);
                  }}
                  className="bg-white/20 backdrop-blur-sm text-white font-semibold py-3 px-6 rounded-full hover:bg-white/30 transition-all border-2 border-white/40"
                >
                  Keep Swiping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
