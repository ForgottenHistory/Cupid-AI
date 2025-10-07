import { useEffect, useState } from 'react';

function SwipeLimitModal({ onClose }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 50);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all duration-500 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="text-center mb-6">
          <div className="text-8xl animate-bounce" style={{ animationDuration: '1s' }}>
            ⏱️
          </div>
        </div>

        {/* Title */}
        <h2 className="text-4xl font-bold text-center text-white mb-2 drop-shadow-lg">
          Out of Swipes!
        </h2>
        <p className="text-center text-white/90 mb-6 text-lg">
          You've used all 5 swipes for today
        </p>

        {/* Message */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/30 mb-6">
          <p className="text-center text-white text-lg">
            Come back tomorrow for 5 more swipes! ✨
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full bg-white text-red-600 font-bold py-3 px-6 rounded-xl hover:bg-red-50 transition-colors shadow-lg"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export default SwipeLimitModal;
