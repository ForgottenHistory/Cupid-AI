import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import MemoriesModal from './MemoriesModal';
import api from '../../services/api';

/**
 * Chat header component with banner, character info, and menu
 */
const ChatHeader = ({ character, characterStatus, messages, totalMessages, hasMoreMessages, onBack, onUnmatch }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [collapsed, setCollapsed] = useState(true);
  const [showMemories, setShowMemories] = useState(false);
  const [memories, setMemories] = useState([]);
  const [loadingMemories, setLoadingMemories] = useState(false);

  // Calculate approximate token count (1 token ≈ 4 characters) for loaded messages
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

  const formatTime = (timeString) => {
    if (!timeString) return null;
    // timeString is in 24-hour format (HH:MM)
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  // Get upcoming activities from schedule
  const getUpcomingActivities = () => {
    if (!character?.cardData?.data?.schedule?.schedule) {
      return [];
    }

    const schedule = character.cardData.data.schedule.schedule;
    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const upcoming = [];
    const todaySchedule = schedule[currentDay] || [];

    // Find activities later today
    for (const block of todaySchedule) {
      if (block.start > currentTime) {
        upcoming.push({
          time: block.start,
          status: block.status,
          activity: block.activity,
          day: 'Today'
        });
      }
    }

    // If we have less than 3 upcoming activities, check tomorrow
    if (upcoming.length < 3) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDay = dayNames[tomorrow.getDay()];
      const tomorrowSchedule = schedule[tomorrowDay] || [];

      for (const block of tomorrowSchedule) {
        if (upcoming.length < 3) {
          upcoming.push({
            time: block.start,
            status: block.status,
            activity: block.activity,
            day: 'Tomorrow'
          });
        }
      }
    }

    return upcoming.slice(0, 3); // Return max 3 upcoming activities
  };

  const upcomingActivities = getUpcomingActivities();

  // Fetch memories when modal opens
  const handleOpenMemories = async () => {
    setShowMemories(true);
    setLoadingMemories(true);

    try {
      const response = await api.get(`/characters/${character.id}/memories`);
      setMemories(response.data.memories || []);
    } catch (error) {
      console.error('Failed to fetch memories:', error);
      setMemories([]);
    } finally {
      setLoadingMemories(false);
    }
  };

  // Add new memory
  const handleAddMemory = async (text, importance) => {
    try {
      const response = await api.post(`/characters/${character.id}/memories`, { text, importance });
      setMemories(response.data.memories || []);
      return true;
    } catch (error) {
      console.error('Failed to add memory:', error);
      alert('Failed to add memory. Please try again.');
      return false;
    }
  };

  // Edit existing memory
  const handleEditMemory = async (index, text, importance) => {
    try {
      const response = await api.put(`/characters/${character.id}/memories/${index}`, { text, importance });
      setMemories(response.data.memories || []);
      return true;
    } catch (error) {
      console.error('Failed to edit memory:', error);
      alert('Failed to edit memory. Please try again.');
      return false;
    }
  };

  // Delete memory
  const handleDeleteMemory = async (index) => {
    try {
      const response = await api.delete(`/characters/${character.id}/memories/${index}`);
      setMemories(response.data.memories || []);
      return true;
    } catch (error) {
      console.error('Failed to delete memory:', error);
      alert('Failed to delete memory. Please try again.');
      return false;
    }
  };

  // Clear all memories
  const handleClearAllMemories = async () => {
    try {
      const response = await api.delete(`/characters/${character.id}/memories`);
      setMemories(response.data.memories || []);
      return true;
    } catch (error) {
      console.error('Failed to clear memories:', error);
      alert('Failed to clear memories. Please try again.');
      return false;
    }
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

          {/* Memories Button */}
          <button
            onClick={handleOpenMemories}
            className="p-2.5 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30 hover:scale-110 transition-all shadow-lg border border-white/20"
            title="View memories"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </button>

          {/* Menu Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!showMenu) {
                const rect = e.currentTarget.getBoundingClientRect();
                setDropdownPosition({ x: rect.right - 180, y: rect.bottom + 8 });
              }
              setShowMenu(!showMenu);
            }}
            className="relative z-30 p-2.5 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30 hover:scale-110 transition-all shadow-lg border border-white/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

        </div>

        {/* Dropdown Menu - rendered in portal to escape overflow constraints */}
        {showMenu && createPortal(
          <>
            <div
              className="fixed inset-0 z-[998]"
              onClick={() => setShowMenu(false)}
            />
            <div
              className="fixed bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-purple-100/50 dark:border-purple-900/50 rounded-xl shadow-xl py-1 min-w-[180px] z-[999]"
              style={{
                left: `${dropdownPosition.x}px`,
                top: `${dropdownPosition.y}px`
              }}
            >
                <div className="px-4 py-2.5 text-gray-700 dark:text-gray-300 text-sm border-b border-purple-100/50 dark:border-purple-900/50">
                  <div className="flex items-center gap-2 font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Conversation</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {hasMoreMessages ? (
                      <>
                        {messages.length.toLocaleString()} of {totalMessages.toLocaleString()} messages loaded
                        <br />
                        ~{calculateTokens().toLocaleString()} tokens (loaded)
                      </>
                    ) : (
                      <>
                        {totalMessages.toLocaleString()} {totalMessages === 1 ? 'message' : 'messages'}
                        <br />
                        ~{calculateTokens().toLocaleString()} tokens
                      </>
                    )}
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
          </>,
          document.body
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
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!showSchedule) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setDropdownPosition({ x: rect.left, y: rect.bottom + 8 });
                    }
                    setShowSchedule(!showSchedule);
                  }}
                  className="text-xs font-semibold drop-shadow-lg capitalize bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/20 hover:bg-black/30 transition-all cursor-pointer flex items-center gap-1"
                >
                  {characterStatus.status}
                  {characterStatus.activity && ` • ${characterStatus.activity}`}
                  {characterStatus.nextChange && ` • ${formatEndTime(characterStatus.nextChange)}`}
                  {upcomingActivities.length > 0 && (
                    <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>

                {/* Schedule Dropdown */}
                {showSchedule && upcomingActivities.length > 0 && createPortal(
                  <>
                    <div
                      className="fixed inset-0 z-[998]"
                      onClick={() => setShowSchedule(false)}
                    />
                    <div
                      className="fixed bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-purple-100/50 dark:border-purple-900/50 rounded-xl shadow-xl py-2 min-w-[280px] z-[999]"
                      style={{
                        left: `${dropdownPosition.x}px`,
                        top: `${dropdownPosition.y}px`
                      }}
                    >
                      <div className="px-3 py-2 text-gray-700 dark:text-gray-300 text-xs border-b border-purple-100/50 dark:border-purple-900/50">
                        <div className="flex items-center gap-2 font-semibold">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Upcoming Schedule</span>
                        </div>
                      </div>
                      <div className="py-1">
                        {upcomingActivities.map((activity, index) => (
                          <div
                            key={index}
                            className="px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 ${getStatusColor(activity.status)} rounded-full flex-shrink-0`}></div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-gray-900 dark:text-gray-100 capitalize">
                                  {activity.status}
                                  {activity.activity && ` • ${activity.activity}`}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {activity.day} at {formatTime(activity.time)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>,
                  document.body
                )}
              </div>
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
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!showSchedule) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setDropdownPosition({ x: rect.left, y: rect.bottom + 8 });
                        }
                        setShowSchedule(!showSchedule);
                      }}
                      className="text-sm font-semibold drop-shadow-lg capitalize bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20 hover:bg-black/30 transition-all cursor-pointer flex items-center gap-1"
                    >
                      {characterStatus.status}
                      {characterStatus.activity && ` • ${characterStatus.activity}`}
                      {characterStatus.nextChange && ` • ${formatEndTime(characterStatus.nextChange)}`}
                      {upcomingActivities.length > 0 && (
                        <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>

                    {/* Schedule Dropdown */}
                    {showSchedule && upcomingActivities.length > 0 && createPortal(
                      <>
                        <div
                          className="fixed inset-0 z-[998]"
                          onClick={() => setShowSchedule(false)}
                        />
                        <div
                          className="fixed bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-purple-100/50 dark:border-purple-900/50 rounded-xl shadow-xl py-2 min-w-[280px] z-[999]"
                          style={{
                            left: `${dropdownPosition.x}px`,
                            top: `${dropdownPosition.y}px`
                          }}
                        >
                          <div className="px-3 py-2 text-gray-700 dark:text-gray-300 text-xs border-b border-purple-100/50 dark:border-purple-900/50">
                            <div className="flex items-center gap-2 font-semibold">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>Upcoming Schedule</span>
                            </div>
                          </div>
                          <div className="py-1">
                            {upcomingActivities.map((activity, index) => (
                              <div
                                key={index}
                                className="px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 ${getStatusColor(activity.status)} rounded-full flex-shrink-0`}></div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-gray-900 dark:text-gray-100 capitalize">
                                      {activity.status}
                                      {activity.activity && ` • ${activity.activity}`}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {activity.day} at {formatTime(activity.time)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>,
                      document.body
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Memories Modal */}
      <MemoriesModal
        isOpen={showMemories}
        onClose={() => setShowMemories(false)}
        characterId={character.id}
        characterName={character.name}
        memories={memories}
        loading={loadingMemories}
        onAdd={handleAddMemory}
        onEdit={handleEditMemory}
        onDelete={handleDeleteMemory}
        onClearAll={handleClearAllMemories}
      />
    </div>
  );
};

export default ChatHeader;
