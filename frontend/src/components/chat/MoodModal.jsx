/**
 * Modal that appears when character's mood changes
 * Shows what the character is feeling with animated emoji
 */
const MoodModal = ({ effect, characterName, onClose }) => {
  if (!effect || effect === 'none') return null;

  // Get emoji and feeling text based on effect type
  const getMoodInfo = () => {
    switch (effect) {
      case 'hearts':
        return { emoji: '❤️', feeling: 'feeling romantic', color: 'from-pink-500 to-red-500' };
      case 'stars':
        return { emoji: '⭐', feeling: 'feeling excited', color: 'from-yellow-400 to-orange-500' };
      case 'laugh':
        return { emoji: '😂', feeling: 'finding this hilarious', color: 'from-yellow-300 to-yellow-500' };
      case 'sparkles':
        return { emoji: '✨', feeling: 'feeling magical', color: 'from-purple-400 to-pink-400' };
      case 'fire':
        return { emoji: '🔥', feeling: 'feeling passionate', color: 'from-orange-500 to-red-600' };
      case 'roses':
        return { emoji: '🌹', feeling: 'feeling sweet', color: 'from-pink-400 to-rose-500' };
      default:
        return { emoji: '❤️', feeling: 'feeling something', color: 'from-purple-500 to-pink-500' };
    }
  };

  const { emoji, feeling, color } = getMoodInfo();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full p-8 text-center animate-scale-up">
        {/* Emoji */}
        <div className="text-8xl mb-4 animate-pulse-slow">
          {emoji}
        </div>

        {/* Character name and feeling */}
        <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">
          {characterName}
        </h2>
        <p className={`text-xl font-semibold bg-gradient-to-r ${color} bg-clip-text text-transparent mb-6`}>
          {feeling}
        </p>

        {/* Close button */}
        <button
          onClick={onClose}
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg"
        >
          Got it!
        </button>
      </div>
    </div>
  );
};

export default MoodModal;
