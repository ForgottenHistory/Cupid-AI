import { useState } from 'react';

/**
 * Chat header component with banner, character info, and menu
 */
const ChatHeader = ({ character, characterStatus, onBack, onUnmatch }) => {
  const [showMenu, setShowMenu] = useState(false);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'online':
        return 'bg-green-400';
      case 'away':
        return 'bg-yellow-400';
      case 'busy':
        return 'bg-red-400';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="relative flex-shrink-0">
      {/* Banner Image */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={character.imageUrl}
          alt={character.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60"></div>

        {/* Back Button */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 p-2 bg-black/30 backdrop-blur-sm text-white rounded-full hover:bg-black/50 transition"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Menu Button */}
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 bg-black/30 backdrop-blur-sm text-white rounded-full hover:bg-black/50 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-12 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px] z-20">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onUnmatch();
                  }}
                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Unmatch
                </button>
              </div>
            </>
          )}
        </div>

        {/* Character Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <div className="flex items-end gap-4">
            <img
              src={character.imageUrl}
              alt={character.name}
              className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-xl"
            />
            <div className="flex-1 pb-1">
              <h2 className="text-2xl font-bold drop-shadow-lg">{character.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2.5 h-2.5 rounded-full shadow-lg ${getStatusColor(characterStatus.status)}`}></div>
                <span className="text-sm font-medium drop-shadow capitalize">
                  {characterStatus.status}
                  {characterStatus.activity && ` • ${characterStatus.activity}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
