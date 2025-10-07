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
      <div className="relative h-52 overflow-hidden">
        <img
          src={character.imageUrl}
          alt={character.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-purple-900/30 to-black/70"></div>

        {/* Back Button */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 p-2.5 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30 hover:scale-110 transition-all shadow-lg border border-white/20"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Menu Button */}
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2.5 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30 hover:scale-110 transition-all shadow-lg border border-white/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-14 bg-white/95 backdrop-blur-md border border-purple-100/50 rounded-xl shadow-xl py-1 min-w-[160px] z-20">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onUnmatch();
                  }}
                  className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-all font-medium flex items-center gap-2"
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
            {/* Avatar with gradient ring and glow */}
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-400 to-purple-500 rounded-2xl blur-lg opacity-60"></div>
              <div className="relative p-1 bg-gradient-to-br from-pink-400 to-purple-500 rounded-2xl">
                <img
                  src={character.imageUrl}
                  alt={character.name}
                  className="w-24 h-32 rounded-xl object-cover border-4 border-white shadow-2xl"
                  style={{ imageRendering: '-webkit-optimize-contrast' }}
                />
              </div>
              {/* Status indicator with glow */}
              <div className={`absolute bottom-1 right-1 w-5 h-5 ${getStatusColor(characterStatus.status)} border-3 border-white rounded-full shadow-xl`}>
                <div className={`absolute inset-0 ${getStatusColor(characterStatus.status)} rounded-full animate-ping opacity-75`}></div>
              </div>
            </div>
            <div className="flex-1 pb-2">
              <h2 className="text-2xl font-bold drop-shadow-2xl mb-1">{character.name}</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold drop-shadow-lg capitalize bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20">
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
