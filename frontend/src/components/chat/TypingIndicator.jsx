/**
 * Typing indicator component
 * @param {string} characterName - The character's name
 */
const TypingIndicator = ({ characterName }) => {
  return (
    <div className="flex justify-start px-2 py-1">
      <p className="text-sm text-gray-400 italic">
        {characterName} is typing...
      </p>
    </div>
  );
};

export default TypingIndicator;
