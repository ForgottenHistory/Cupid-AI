import { useState, memo, useRef, useEffect } from 'react';

const CharacterCard = memo(({ character, onDelete, onClick, thumbnailUrl }) => {
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleDelete = async (e) => {
    e.stopPropagation();

    if (!window.confirm(`Delete ${character.name}?`)) {
      return;
    }

    setDeleting(true);
    try {
      await onDelete(character.id);
    } catch (error) {
      alert(`Failed to delete character: ${error.message}`);
      setDeleting(false);
    }
  };

  return (
    <div
      ref={cardRef}
      onClick={() => onClick(character)}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      className="relative group cursor-pointer"
    >
      <div className="aspect-[3/4] rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow bg-gray-200">
        {isVisible ? (
          <img
            src={thumbnailUrl || character.imageUrl}
            alt={character.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-300 dark:bg-gray-600 animate-pulse" />
        )}

        {/* Overlay with character info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-white font-bold text-lg mb-1">{character.name}</h3>
            {/* Support both lightweight (character.bio) and full format */}
            {(character.bio || character.cardData?.data?.description) && (
              <p className="text-white/90 text-sm line-clamp-2">
                {character.bio || character.cardData.data.description}
              </p>
            )}
          </div>
        </div>

        {/* Like badge */}
        {character.isLiked && (
          <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                clipRule="evenodd"
              />
            </svg>
            Liked
          </div>
        )}

        {/* Delete button */}
        {(showDelete || deleting) && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="absolute top-2 left-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-colors disabled:opacity-50"
          >
            {deleting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
});

CharacterCard.displayName = 'CharacterCard';

const CompactCharacterRow = memo(({ character, onDelete, onClick, thumbnailUrl }) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${character.name}?`)) return;

    setDeleting(true);
    try {
      await onDelete(character.id);
    } catch (error) {
      alert(`Failed to delete character: ${error.message}`);
      setDeleting(false);
    }
  };

  return (
    <div
      onClick={() => onClick(character)}
      className="flex items-center gap-3 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-500 hover:shadow-md cursor-pointer transition group"
    >
      <img
        src={thumbnailUrl || character.imageUrl}
        alt={character.name}
        className="w-10 h-12 rounded object-cover flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{character.name}</div>
        {/* Support both lightweight (character.tags) and full format */}
        {(character.tags?.length > 0 || character.cardData?.data?.tags?.length > 0) && (
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {(character.tags || character.cardData.data.tags).slice(0, 3).join(', ')}
          </div>
        )}
      </div>
      {character.isLiked && (
        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-full flex-shrink-0">
          Liked
        </span>
      )}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50 flex-shrink-0"
      >
        {deleting ? (
          <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
      </button>
    </div>
  );
});

CompactCharacterRow.displayName = 'CompactCharacterRow';

const CharacterGrid = ({ characters, onDelete, onCharacterClick, emptyMessage, thumbnails = {}, viewMode = 'grid' }) => {
  if (characters.length === 0) {
    return (
      <div className="text-center py-16">
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
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p className="text-gray-500 text-lg">
          {emptyMessage || 'No characters yet'}
        </p>
      </div>
    );
  }

  if (viewMode === 'compact') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {characters.map((character) => (
          <CompactCharacterRow
            key={character.id}
            character={character}
            onDelete={onDelete}
            onClick={onCharacterClick}
            thumbnailUrl={thumbnails[character.id]}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          onDelete={onDelete}
          onClick={onCharacterClick}
          thumbnailUrl={thumbnails[character.id]}
        />
      ))}
    </div>
  );
};

export default CharacterGrid;
