import { useEffect, useRef } from 'react';
import twemoji from 'twemoji';

/**
 * Emoji component that renders emojis using Twemoji (Apple-style emoji images)
 * @param {string} emoji - The emoji character(s) to render
 * @param {string} className - Optional CSS classes to apply
 * @param {string} size - Size of emoji (default: '1.25em')
 */
const Emoji = ({ emoji, className = '', size = '1.25em' }) => {
  const emojiRef = useRef(null);

  useEffect(() => {
    if (emojiRef.current && emoji) {
      // Parse the emoji and replace with Twemoji SVG
      twemoji.parse(emojiRef.current, {
        folder: 'svg',
        ext: '.svg',
      });

      // Set the size for all emoji images
      const images = emojiRef.current.querySelectorAll('img.emoji');
      images.forEach(img => {
        img.style.width = size;
        img.style.height = size;
        img.style.display = 'inline-block';
        img.style.verticalAlign = 'middle';
      });
    }
  }, [emoji, size]);

  return (
    <span ref={emojiRef} className={className}>
      {emoji}
    </span>
  );
};

export default Emoji;
