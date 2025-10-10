import { useState } from 'react';

/**
 * Chat header component with banner, character info, and menu
 */
const ChatHeader = ({ character, characterStatus, messages, onBack, onUnmatch }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Calculate approximate token count (1 token ≈ 4 characters)
  const calculateTokens = () => {
    if (!messages || messages.length === 0) return 0;
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(totalChars / 4);
  };

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

  const formatEndTime = (timeString) => {
    if (!timeString) return null;
    // timeString is in 24-hour format (HH:MM)
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `until ${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  return (
    <div className="relative flex-shrink-0">
      {/* Banner Image */}
      <div className={`relative overflow-hidden transition-all duration-300 ${collapsed ? 'h-16' : 'h-52'}`}>
        <img
          src={character.imageUrl}
          alt={character.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-purple-900/30 to-black/70 dark:from-black/40 dark:via-purple-950/50 dark:to-black/80"></div>

        {/* Top Right Buttons */}
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
          {/* Collapse/Expand Button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2.5 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30 hover:scale-110 transition-all shadow-lg border border-white/20"
            title={collapsed ? 'Expand banner' : 'Collapse banner'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
              )}
            </svg>
          </button>

          {/* Menu Button */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="relative z-30 p-2.5 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30 hover:scale-110 transition-all shadow-lg border border-white/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

        </div>

        {/* Dropdown Menu */}
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-4 top-20 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-purple-100/50 dark:border-purple-900/50 rounded-xl shadow-xl py-1 min-w-[180px] z-20">
                <div className="px-4 py-2.5 text-gray-700 dark:text-gray-300 text-sm border-b border-purple-100/50 dark:border-purple-900/50">
                  <div className="flex items-center gap-2 font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Conversation</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    ~{calculateTokens().toLocaleString()} tokens
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onUnmatch();
                  }}
                  className="w-full text-left px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all font-medium flex items-center gap-2"
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

        {/* Character Info Overlay */}
        {collapsed ? (
          // Compact mode - just name and status
          <div className="absolute bottom-0 left-0 right-0 px-6 py-3 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-3 h-3 ${getStatusColor(characterStatus.status)} rounded-full shadow-lg`}>
                  <div className={`absolute inset-0 ${getStatusColor(characterStatus.status)} rounded-full animate-ping opacity-75`}></div>
                </div>
              </div>
              <h2 className="text-lg font-bold drop-shadow-2xl">{character.name}</h2>
              <span className="text-xs font-semibold drop-shadow-lg capitalize bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/20">
                {characterStatus.status}
                {characterStatus.activity && ` • ${characterStatus.activity}`}
                {characterStatus.nextChange && ` • ${formatEndTime(characterStatus.nextChange)}`}
              </span>
            </div>
          </div>
        ) : (
          // Full mode - avatar and details
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
                    style={{
                      imageRendering: 'auto',
                      transform: 'translateZ(0)',
                      backfaceVisibility: 'hidden'
                    }}
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
                    {characterStatus.nextChange && ` • ${formatEndTime(characterStatus.nextChange)}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHeader;
