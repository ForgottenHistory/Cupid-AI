import { useState, useRef } from 'react';

const SwipeCard = ({ character, onSwipe, isTop, onClick }) => {
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
      <div className="relative w-full h-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
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
              {/* Support both lightweight (character.age) and full format (cardData.data.datingProfile.age) */}
              {(character.age || character.cardData?.data?.datingProfile?.age) && (
                <p className="text-white/80 text-lg mt-1">{character.age || character.cardData.data.datingProfile.age}</p>
              )}
            </div>
            <div className="ml-3 bg-white/20 backdrop-blur-sm rounded-full p-2 hover:bg-white/30 transition">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          {/* Support both lightweight (character.bio) and full format */}
          {(character.bio || character.cardData?.data?.datingProfile?.bio || character.cardData?.data?.description) && (
            <p className="text-white/90 text-sm mt-2 line-clamp-2">
              {character.bio || character.cardData?.data?.datingProfile?.bio || character.cardData?.data?.description}
            </p>
          )}
          {/* Interests only available with full data */}
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
};

export default SwipeCard;
