import { useNavigate } from 'react-router-dom';

/**
 * Modal animation shown when a character unmatches with the user
 * @param {Object} props
 * @param {Object} props.character - Character who unmatched { name, imageUrl }
 * @param {Function} props.onClose - Callback when modal is dismissed
 */
const UnmatchModal = ({ character, onClose }) => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    onClose();
    navigate('/');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={handleGoHome}
    >
      <div className="relative animate-scale-up">
        {/* Floating Broken Hearts */}
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
              {/* Broken Heart SVG */}
              <svg className="w-8 h-8 text-gray-400 opacity-70" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                {/* Crack through the heart */}
                <path d="M12 3 L12 21 M8 8 L16 14 M16 8 L8 14" stroke="white" strokeWidth="1" opacity="0.8" />
              </svg>
            </div>
          ))}
        </div>

        {/* Unmatch Content */}
        <div className="relative bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 p-8 rounded-3xl shadow-2xl max-w-md border-2 border-red-500/50">
          <div className="text-center mb-6">
            <h2 className="text-6xl font-black text-red-500 mb-2 animate-pulse-slow">
              UNMATCHED
            </h2>
            <p className="text-white/90 text-lg">
              {character?.name || 'The character'} has unmatched with you
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/10">
            <div className="flex items-center gap-4">
              {character?.imageUrl && (
                <img
                  src={character.imageUrl}
                  alt={character.name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-600 shadow-lg grayscale"
                />
              )}
              <div className="flex-1 text-white">
                <h3 className="text-2xl font-bold">{character?.name || 'Character'}</h3>
                <p className="text-gray-400 text-sm mt-2">
                  Sometimes things don't work out. Keep swiping to find your match!
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGoHome();
              }}
              className="w-full bg-gradient-to-r from-gray-600 to-gray-700 text-white font-bold py-3 px-6 rounded-full hover:from-gray-500 hover:to-gray-600 transition-all hover:scale-105 shadow-lg border-2 border-gray-500"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnmatchModal;
