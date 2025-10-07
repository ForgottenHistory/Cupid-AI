import { useEffect, useState } from 'react';

function SuperLikeModal({ character, onClose }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation after mount
    setTimeout(() => setIsVisible(true), 50);
  }, []);

  if (!character) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all duration-500 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sparkle effects */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          <div className="absolute top-10 left-10 w-2 h-2 bg-white rounded-full animate-ping" style={{ animationDuration: '1.5s' }}></div>
          <div className="absolute top-20 right-16 w-2 h-2 bg-yellow-200 rounded-full animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }}></div>
          <div className="absolute bottom-16 left-16 w-2 h-2 bg-white rounded-full animate-ping" style={{ animationDuration: '1.8s', animationDelay: '0.6s' }}></div>
          <div className="absolute bottom-20 right-12 w-2 h-2 bg-yellow-200 rounded-full animate-ping" style={{ animationDuration: '2.2s', animationDelay: '0.9s' }}></div>
          <div className="absolute top-1/2 left-8 w-2 h-2 bg-white rounded-full animate-ping" style={{ animationDuration: '1.6s', animationDelay: '1.2s' }}></div>
          <div className="absolute top-1/3 right-10 w-2 h-2 bg-yellow-200 rounded-full animate-ping" style={{ animationDuration: '2.1s', animationDelay: '0.5s' }}></div>
        </div>

        {/* Super Like Icon */}
        <div className="text-center mb-6">
          <div className="text-8xl animate-bounce" style={{ animationDuration: '1s' }}>
            💙
          </div>
        </div>

        {/* Title */}
        <h2 className="text-4xl font-bold text-center text-white mb-2 drop-shadow-lg">
          SUPER LIKE!
        </h2>
        <p className="text-center text-blue-100 mb-6">
          {character.cardData.data.name} is EXTRA interested in you!
        </p>

        {/* Character Image */}
        <div className="flex justify-center mb-6">
          <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-white shadow-xl ring-4 ring-yellow-300 ring-opacity-50">
            <img
              src={character.imageUrl}
              alt={character.cardData.data.name}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Message */}
        <p className="text-center text-white text-lg mb-6 font-medium">
          This means they're really excited about matching with you! 💫
        </p>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full bg-white text-blue-600 font-bold py-3 px-6 rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
        >
          Keep Swiping
        </button>
      </div>
    </div>
  );
}

export default SuperLikeModal;
