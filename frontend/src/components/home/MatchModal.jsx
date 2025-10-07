import { useNavigate } from 'react-router-dom';

const MatchModal = ({ character, onClose }) => {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
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
              You and {character.name} liked each other
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/30">
            <div className="flex items-center gap-4">
              <img
                src={character.imageUrl}
                alt={character.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
              />
              <div className="flex-1 text-white">
                <h3 className="text-2xl font-bold">{character.name}</h3>
                {character.cardData?.data?.datingProfile?.age && (
                  <p className="text-white/80 text-lg">{character.cardData.data.datingProfile.age}</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/chat/${character.id}`);
              }}
              className="flex-1 bg-white text-purple-600 font-bold py-3 px-6 rounded-full hover:bg-purple-50 transition-all hover:scale-105 shadow-lg"
            >
              Send Message
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="bg-white/20 backdrop-blur-sm text-white font-semibold py-3 px-6 rounded-full hover:bg-white/30 transition-all border-2 border-white/40"
            >
              Keep Swiping
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchModal;
