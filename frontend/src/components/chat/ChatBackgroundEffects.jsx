import { useEffect, useState } from 'react';

/**
 * Chat background effects component
 * Displays static background emojis based on mood
 */
const ChatBackgroundEffects = ({ effect, visible }) => {
  const [staticParticles, setStaticParticles] = useState([]);

  useEffect(() => {
    if (!effect || effect === 'none') {
      // Clear all particles when effect is none
      setStaticParticles([]);
      return;
    }

    // Generate static background particles (only once if not already created)
    const generateStaticParticles = () => {
      if (staticParticles.length > 0) return; // Don't regenerate if already exist

      const count = 25;
      const newParticles = [];

      for (let i = 0; i < count; i++) {
        newParticles.push({
          id: `static-${i}`,
          left: Math.random() * 100,
          top: Math.random() * 100,
          size: 0.6 + Math.random() * 0.6, // Size range (0.6-1.2)
          rotation: Math.random() * 360
        });
      }

      setStaticParticles(newParticles);
    };

    generateStaticParticles();
  }, [effect]);

  // Get emoji/element based on effect type
  const getEmoji = () => {
    switch (effect) {
      case 'hearts':
        return '❤️';
      case 'stars':
        return '⭐';
      case 'laugh':
        return '😂';
      case 'sparkles':
        return '✨';
      case 'fire':
        return '🔥';
      case 'roses':
        return '🌹';
      default:
        return '❤️';
    }
  };

  const emoji = getEmoji();

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Static background emojis - Fade in/out */}
      {staticParticles.length > 0 && (
        <div className={`absolute inset-0 transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
          {staticParticles.map((particle) => (
            <div
              key={particle.id}
              className="absolute opacity-20"
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                fontSize: `${particle.size * 2}rem`,
                transform: `rotate(${particle.rotation}deg)`
              }}
            >
              {emoji}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatBackgroundEffects;
