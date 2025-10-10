import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import characterService from '../services/characterService';
import chatService from '../services/chatService';
import { getImageUrl } from '../services/api';
import LLMSettings from './LLMSettings';
import SDSettings from './SDSettings';
import { useDarkMode } from '../hooks/useDarkMode';
import { syncAllCharacters, clearAllPosts } from '../utils/syncCharacterImages';
import io from 'socket.io-client';
import DailyMatchModal from './DailyMatchModal';
import api from '../services/api';

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState({ total: 0, liked: 0, remaining: 0 });
  const [conversations, setConversations] = useState([]);
  const [showLLMSettings, setShowLLMSettings] = useState(false);
  const [showSDSettings, setShowSDSettings] = useState(false);
  const [characterStatuses, setCharacterStatuses] = useState({});
  const socketRef = useRef(null);
  const [dailyMatchCharacter, setDailyMatchCharacter] = useState(null);
  const [showDailyMatchModal, setShowDailyMatchModal] = useState(false);

  // Sync all characters from IndexedDB to backend on mount
  // This ensures all characters are available for post generation
  useEffect(() => {
    if (user?.id) {
      syncAllCharacters(user.id).catch(error => {
        console.error('Failed to sync characters:', error);
      });
    }
  }, [user?.id]);

  // Check for daily auto-match on mount
  useEffect(() => {
    const checkDailyAutoMatch = async () => {
      if (!user?.id) {
        console.log('⏭️ Daily auto-match: Skipping (no user)');
        return;
      }

      try {
        // Get all characters from library
        const allCharacters = await characterService.getAllCharacters(user.id);

        console.log('📚 Daily auto-match: Library check', {
          totalCharacters: allCharacters.length,
          characterNames: allCharacters.map(c => c.name)
        });

        if (allCharacters.length === 0) {
          console.log('⏭️ Daily auto-match: Skipping (no characters in library)');
          return;
        }

        // Filter to only unmatched (not liked) characters before sending
        const unmatchedCharacters = allCharacters.filter(c => !c.isLiked);

        console.log('🔍 Daily auto-match: Filtering', {
          total: allCharacters.length,
          liked: allCharacters.filter(c => c.isLiked).length,
          unmatched: unmatchedCharacters.length
        });

        // Call backend to check and perform auto-match
        const response = await api.post('/characters/daily-auto-match', {
          libraryCharacters: unmatchedCharacters
        });

        console.log('🎲 Daily auto-match: Backend response', response.data);

        if (response.data.autoMatched) {
          // Find the matched character in IndexedDB to get the full character object
          const matchedChar = allCharacters.find(c => c.id === response.data.character.id);

          if (matchedChar) {
            console.log('✨ Daily auto-match: Showing modal for', matchedChar.name);

            // Mark character as liked in IndexedDB
            await characterService.likeCharacter(matchedChar.id);

            // Pass the full character object, just like SuperLikeModal
            setDailyMatchCharacter(matchedChar);
            setShowDailyMatchModal(true);
            // Reload matches to show the new one
            loadMatches();
            loadConversations();
          }
        } else {
          console.log('⏭️ Daily auto-match: Not matched', response.data.reason);
        }
      } catch (error) {
        console.error('❌ Daily auto-match error:', error);
      }
    };

    checkDailyAutoMatch();
  }, [user?.id]);

  // Debug function for testing daily match modal
  useEffect(() => {
    if (user?.id) {
      window.debugDailyMatch = async () => {
        try {
          const allCharacters = await characterService.getAllCharacters(user.id);
          const matchedCharacterIds = matches.map(m => m.id);
          const unmatchedCharacters = allCharacters.filter(
            char => !matchedCharacterIds.includes(char.id)
          );

          if (unmatchedCharacters.length === 0) {
            console.log('❌ All characters already matched');
            return;
          }

          const randomChar = unmatchedCharacters[Math.floor(Math.random() * unmatchedCharacters.length)];

          console.log('🔍 Debug - Passing full character object:', {
            id: randomChar.id,
            name: randomChar.name,
            hasImageUrl: !!randomChar.imageUrl,
            hasCardData: !!randomChar.cardData
          });

          // Pass the full character object, just like SuperLikeModal
          setDailyMatchCharacter(randomChar);
          setShowDailyMatchModal(true);
          console.log('✨ Daily match modal triggered for:', randomChar.name);
        } catch (error) {
          console.error('Debug daily match error:', error);
        }
      };

      window.resetDailyMatch = async () => {
        try {
          await api.post('/characters/reset-daily-match');
          console.log('🔄 Daily match timer reset! Refresh the page to get a new match.');
        } catch (error) {
          console.error('Failed to reset daily match:', error);
        }
      };
    }

    return () => {
      delete window.debugDailyMatch;
      delete window.resetDailyMatch;
    };
  }, [user?.id, matches]);

  useEffect(() => {
    loadMatches();
    loadStats();
    loadConversations();
  }, [user?.id, location.pathname]);

  useEffect(() => {
    // Listen for character updates
    const handleCharacterUpdate = () => {
      loadMatches();
      loadStats();
      loadConversations();
      loadCharacterStatuses();
    };

    window.addEventListener('characterUpdated', handleCharacterUpdate);
    return () => window.removeEventListener('characterUpdated', handleCharacterUpdate);
  }, [user?.id]);

  useEffect(() => {
    // Load character statuses when matches change
    if (matches.length > 0) {
      loadCharacterStatuses();
    }
  }, [matches.length]);

  useEffect(() => {
    // Poll character statuses every minute
    if (matches.length === 0) return;

    const interval = setInterval(() => {
      loadCharacterStatuses();
    }, 60000); // Poll every 60 seconds

    return () => clearInterval(interval);
  }, [matches.length]);

  // WebSocket connection for real-time unread count updates
  useEffect(() => {
    if (!user?.id) return;

    // Connect to WebSocket server
    const socket = io('http://localhost:3000', {
      transports: ['websocket'],
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 MainLayout: WebSocket connected');
      socket.emit('join', user.id);
    });

    socket.on('disconnect', () => {
      console.log('🔌 MainLayout: WebSocket disconnected');
    });

    // Listen for new messages to update unread counts
    socket.on('new_message', (data) => {
      console.log('💬 MainLayout: New message received, reloading conversations');
      loadConversations();
    });

    return () => {
      console.log('🔌 MainLayout: Cleaning up WebSocket');
      socket.disconnect();
    };
  }, [user?.id]);

  const loadMatches = async () => {
    if (!user?.id) return;
    try {
      const likedChars = await characterService.getLikedCharacters(user.id);
      setMatches(likedChars);
    } catch (error) {
      console.error('Failed to load matches:', error);
    }
  };

  const loadConversations = async () => {
    if (!user?.id) return;
    try {
      const convs = await chatService.getConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadCharacterStatuses = async () => {
    if (!user?.id || matches.length === 0) return;
    try {
      const dataPromises = matches.map(async (match) => {
        try {
          // Get schedule from character card data (stored in IndexedDB)
          const schedule = match.cardData?.data?.schedule;
          const status = await characterService.getCharacterStatus(match.id, schedule);
          return { characterId: match.id, status };
        } catch (err) {
          console.error(`Failed to load status for ${match.id}:`, err);
          return { characterId: match.id, status: null };
        }
      });
      const results = await Promise.all(dataPromises);
      const statusMap = {};
      results.forEach(({ characterId, status }) => {
        statusMap[characterId] = status;
      });
      setCharacterStatuses(statusMap);
    } catch (error) {
      console.error('Failed to load character statuses:', error);
    }
  };

  const loadStats = async () => {
    if (!user?.id) return;
    try {
      const newStats = await characterService.getStats(user.id);
      setStats(newStats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const getUnreadCount = (characterId) => {
    const conversation = conversations.find(c => c.character_id === characterId);
    return conversation?.unread_count || 0;
  };

  const getStatusIndicatorColor = (status) => {
    if (!status) return 'bg-gray-400';
    switch (status.toLowerCase()) {
      case 'online':
        return 'bg-green-400';
      case 'away':
        return 'bg-yellow-400';
      case 'busy':
        return 'bg-red-400';
      case 'offline':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = (characterId) => {
    const statusData = characterStatuses[characterId];
    if (!statusData) return 'Loading...';

    const { status, activity } = statusData;

    // Format status text
    let text = status.charAt(0).toUpperCase() + status.slice(1);
    if (activity) {
      text += ` • ${activity}`;
    }

    // Truncate to ~40 characters
    return text.length > 40 ? text.substring(0, 40) + '...' : text;
  };

  // Get sorted matches by most recent activity
  const getSortedMatches = () => {
    return [...matches].sort((a, b) => {
      const convA = conversations.find(c => c.character_id === a.id);
      const convB = conversations.find(c => c.character_id === b.id);

      // If both have conversations, sort by last message time
      if (convA?.last_message_at && convB?.last_message_at) {
        return new Date(convB.last_message_at) - new Date(convA.last_message_at);
      }

      // If only A has conversation, A comes first
      if (convA?.last_message_at) return -1;

      // If only B has conversation, B comes first
      if (convB?.last_message_at) return 1;

      // If neither has conversation, maintain original order
      return 0;
    });
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Left Sidebar */}
      <div className="w-96 bg-gradient-to-b from-white via-purple-50/20 to-pink-50/20 dark:from-gray-800 dark:via-gray-800/80 dark:to-gray-900/80 border-r border-purple-100/50 dark:border-gray-700/50 shadow-xl flex flex-col backdrop-blur-sm">
        {/* Logo/Brand */}
        <div className="p-6 border-b border-purple-100/50 dark:border-gray-700/50 backdrop-blur-md bg-white/40 dark:bg-gray-800/40">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            Cupid AI
          </h1>
        </div>

        {/* Matches List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-5">
            <div className="mb-5 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 backdrop-blur-md border border-purple-200/30 dark:border-purple-700/30">
              <h2 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-purple-600 uppercase tracking-wider">
                Matches ({stats.liked})
              </h2>
            </div>

            {matches.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30 flex items-center justify-center shadow-lg">
                  <svg className="w-10 h-10 text-purple-400 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <p className="text-gray-700 dark:text-gray-300 font-semibold text-sm mb-1">No matches yet</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs">Start swiping to find characters you like!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {getSortedMatches().map((match) => {
                  const unreadCount = getUnreadCount(match.id);
                  return (
                    <div
                      key={match.id}
                      className="group relative flex items-center gap-3 p-3 rounded-2xl bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-100/50 dark:border-gray-600/50 hover:border-purple-300/50 dark:hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-100/50 dark:hover:shadow-purple-900/30 hover:scale-[1.02] cursor-pointer transition-all duration-300"
                      onClick={() => navigate(`/chat/${match.id}`)}
                    >
                      {/* Avatar with permanent gradient ring */}
                      <div className="relative flex-shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-400 to-purple-500 rounded-xl blur-md opacity-40 group-hover:opacity-60 transition-opacity"></div>
                        <div className="relative p-0.5 bg-gradient-to-br from-pink-400 to-purple-500 rounded-xl">
                          <img
                            src={match.imageUrl}
                            alt={match.name}
                            className="w-16 h-20 rounded-lg object-cover border-2 border-white"
                            style={{
                              imageRendering: 'auto',
                              transform: 'translateZ(0)',
                              backfaceVisibility: 'hidden'
                            }}
                          />
                        </div>
                        {/* Status indicator with glow */}
                        <div className={`absolute bottom-0.5 right-0.5 w-4 h-4 ${getStatusIndicatorColor(characterStatuses[match.id]?.status)} border-2 border-white rounded-full shadow-lg`}>
                          <div className={`absolute inset-0 ${getStatusIndicatorColor(characterStatuses[match.id]?.status)} rounded-full animate-ping opacity-75`}></div>
                        </div>
                        {/* Unread badge with pulse */}
                        {unreadCount > 0 && (
                          <div className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1.5 bg-gradient-to-r from-pink-500 to-purple-600 border-2 border-white rounded-full flex items-center justify-center shadow-lg animate-pulse">
                            <span className="text-white text-xs font-bold">
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">
                            {match.name}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {unreadCount > 0 ? (
                            <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-purple-600 flex items-center gap-1">
                              <svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              {unreadCount} new {unreadCount === 1 ? 'message' : 'messages'}
                            </span>
                          ) : (
                            <span className="truncate">{getStatusText(match.id)}</span>
                          )}
                        </p>
                      </div>

                      {/* Chevron indicator */}
                      <svg
                        className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-purple-500 dark:group-hover:text-purple-400 group-hover:translate-x-1 transition-all opacity-0 group-hover:opacity-100"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* User Profile at Bottom */}
        <div className="border-t border-purple-100/50 dark:border-gray-700/50 p-4 bg-white/40 dark:bg-gray-800/40 backdrop-blur-md">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-pink-50/50 to-purple-50/50 dark:from-gray-700/50 dark:to-gray-800/50 border border-purple-100/30 dark:border-gray-600/30">
            <div
              onClick={() => navigate('/profile')}
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition"
            >
              {user?.profile_image ? (
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full blur-sm opacity-50"></div>
                  <img
                    src={getImageUrl(user.profile_image)}
                    alt="Profile"
                    className="relative w-10 h-10 rounded-full object-cover border-2 border-white shadow-md"
                  />
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full blur-sm opacity-50"></div>
                  <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    {(user?.display_name || user?.username || 'U').charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate text-sm">
                  {user?.display_name || user?.username}
                </h3>
                <p className="text-xs font-medium text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-purple-600">
                  {stats.remaining} to swipe
                </p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-white/60 dark:hover:bg-gray-600/60 rounded-lg transition-all"
              title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            >
              {isDarkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setShowLLMSettings(true)}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-white/60 dark:hover:bg-gray-600/60 rounded-lg transition-all"
              title="LLM Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={() => setShowSDSettings(true)}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-white/60 dark:hover:bg-gray-600/60 rounded-lg transition-all"
              title="Image Generation Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-white/60 dark:hover:bg-gray-600/60 rounded-lg transition-all"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <button
                onClick={() => navigate('/')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  isActive('/')
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Discover
                </div>
              </button>

              <button
                onClick={() => navigate('/feed')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  isActive('/feed')
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  Feed
                </div>
              </button>

              <button
                onClick={() => navigate('/library')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  isActive('/library')
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Library
                </div>
              </button>

              <button
                onClick={() => navigate('/voices')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  isActive('/voices')
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                  Voices
                </div>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {stats.liked} matches · {stats.total} characters
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>

      {/* LLM Settings Modal */}
      {showLLMSettings && (
        <LLMSettings onClose={() => setShowLLMSettings(false)} />
      )}

      {/* SD Settings Modal */}
      {showSDSettings && (
        <SDSettings onClose={() => setShowSDSettings(false)} />
      )}

      {/* Daily Match Modal */}
      {showDailyMatchModal && dailyMatchCharacter && (
        <DailyMatchModal
          character={dailyMatchCharacter}
          onClose={() => {
            setShowDailyMatchModal(false);
            setDailyMatchCharacter(null);
          }}
        />
      )}
    </div>
  );
};

export default MainLayout;
