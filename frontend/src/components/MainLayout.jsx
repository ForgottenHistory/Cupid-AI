import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import characterService from '../services/characterService';
import chatService from '../services/chatService';
import { getImageUrl } from '../services/api';
import LLMSettings from './LLMSettings';

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState({ total: 0, liked: 0, remaining: 0 });
  const [conversations, setConversations] = useState([]);
  const [showLLMSettings, setShowLLMSettings] = useState(false);

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
    };

    window.addEventListener('characterUpdated', handleCharacterUpdate);
    return () => window.removeEventListener('characterUpdated', handleCharacterUpdate);
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

  const getLastMessage = (characterId) => {
    const conversation = conversations.find(c => c.character_id === characterId);
    if (!conversation?.last_message) return 'Start chatting...';
    // Truncate to ~40 characters
    const message = conversation.last_message;
    return message.length > 40 ? message.substring(0, 40) + '...' : message;
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Left Sidebar */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo/Brand */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            AI Dater
          </h1>
        </div>

        {/* Matches List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Matches ({stats.liked})
            </h2>

            {matches.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium text-sm">No matches yet</p>
                <p className="text-gray-400 text-xs mt-1">Start swiping to find characters you like!</p>
              </div>
            ) : (
              <div className="space-y-1">
                {matches.map((match) => {
                  const unreadCount = getUnreadCount(match.id);
                  return (
                    <div
                      key={match.id}
                      className="group relative flex items-center gap-3 p-3 rounded-xl hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 cursor-pointer transition-all duration-200"
                      onClick={() => navigate(`/chat/${match.id}`)}
                    >
                      {/* Avatar with gradient ring */}
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <img
                          src={match.imageUrl}
                          alt={match.name}
                          className="relative w-14 h-14 rounded-full object-cover border-2 border-white shadow-md"
                        />
                        {/* Online indicator */}
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-400 border-2 border-white rounded-full"></div>
                        {/* Unread badge */}
                        {unreadCount > 0 && (
                          <div className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-gradient-to-r from-pink-500 to-purple-600 border-2 border-white rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-white text-xs font-bold">
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                            {match.name}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          {unreadCount > 0 ? (
                            <span className="font-medium text-purple-600">
                              {unreadCount} new {unreadCount === 1 ? 'message' : 'messages'}
                            </span>
                          ) : (
                            <span className="truncate">{getLastMessage(match.id)}</span>
                          )}
                        </p>
                      </div>

                      {/* Chevron indicator */}
                      <svg
                        className="w-5 h-5 text-gray-300 group-hover:text-purple-400 transition-colors opacity-0 group-hover:opacity-100"
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
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div
              onClick={() => navigate('/profile')}
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition"
            >
              {user?.profile_image ? (
                <img
                  src={getImageUrl(user.profile_image)}
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                  {(user?.display_name || user?.username || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate text-sm">
                  {user?.display_name || user?.username}
                </h3>
                <p className="text-xs text-gray-500">
                  {stats.remaining} to swipe
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowLLMSettings(true)}
              className="text-gray-400 hover:text-gray-600 transition"
              title="LLM Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-gray-600 transition"
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
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <button
                onClick={() => navigate('/')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  isActive('/')
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
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
                onClick={() => navigate('/library')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  isActive('/library')
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Library
                </div>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-600">
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
    </div>
  );
};

export default MainLayout;
