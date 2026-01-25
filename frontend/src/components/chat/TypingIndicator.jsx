/**
 * Typing indicator component
 * @param {string} characterName - The character's name
 */
const TypingIndicator = ({ characterName }) => {
  return (
    <div className="flex justify-start px-2 py-1">
      {/* Spacer to align with assistant messages (accounts for action buttons) */}
      <div className="w-[92px]" />
      <p className="text-sm text-gray-400 italic">
        {characterName} is typing...
      </p>
    </div>
  );
};

export default TypingIndicator;
