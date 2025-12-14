import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import MemoriesModal from './MemoriesModal';
import PostInstructionsModal from './PostInstructionsModal';
import CharacterMoodModal from './CharacterMoodModal';
import ChatHeaderMenu from './ChatHeaderMenu';
import CharacterStatusBar from './CharacterStatusBar';
import CharacterProfile from '../CharacterProfile';
import api from '../../services/api';
import chatService from '../../services/chatService';

/**
 * Chat header component with banner, character info, and menu
 */
const ChatHeader = ({ character, characterStatus, characterMood, characterState, messages, totalMessages, hasMoreMessages, onBack, onUnmatch, conversationId, onMoodUpdate }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showLibraryCard, setShowLibraryCard] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });

  // Banner collapsed state (persistent, default collapsed)
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('chatBannerCollapsed');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Persist banner collapsed state
  useEffect(() => {
    localStorage.setItem('chatBannerCollapsed', JSON.stringify(collapsed));
  }, [collapsed]);

  const [showMemories, setShowMemories] = useState(false);
  const [memories, setMemories] = useState([]);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [showPostInstructions, setShowPostInstructions] = useState(false);
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Check if mood should be shown (only if last message is within 30 minutes)
  const isMoodFresh = () => {
    if (!messages || messages.length === 0) return false;
    const lastMessage = [...messages].reverse().find(m => m.role === 'user' || m.role === 'assistant');
    if (!lastMessage?.created_at) return false;
    const lastMessageTime = new Date(lastMessage.created_at).getTime();
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    return lastMessageTime > thirtyMinutesAgo;
  };

  const showMood = characterMood && isMoodFresh();
  const showState = characterState && characterState !== 'none' && isMoodFresh();

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

    return upcoming.slice(0, 3);
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

  // Memory handlers
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

  // Export conversation
  const handleExport = async () => {
    if (!conversationId || exporting) return;

    setExporting(true);
    try {
      await chatService.exportConversation(conversationId);
    } catch (error) {
      console.error('Failed to export conversation:', error);
      alert('Failed to export conversation. Please try again.');
    } finally {
      setExporting(false);
      setShowMenu(false);
    }
  };

  // Update character mood
  const handleSaveMood = async (newMood) => {
    try {
      await api.put(`/chat/conversations/${character.id}/mood`, { mood: newMood });
      if (onMoodUpdate) {
        onMoodUpdate(newMood);
      }
    } catch (error) {
      console.error('Failed to update mood:', error);
      throw error;
    }
  };

  // Open library card modal
  const handleOpenLibraryCard = () => {
    setShowLibraryCard(true);
  };

  const handleMenuClick = (e) => {
    e.stopPropagation();
    if (!showMenu) {
      const rect = e.currentTarget.getBoundingClientRect();
      setDropdownPosition({ x: rect.right - 180, y: rect.bottom + 8 });
    }
    setShowMenu(!showMenu);
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
            onClick={handleMenuClick}
            className="relative z-30 p-2.5 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30 hover:scale-110 transition-all shadow-lg border border-white/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>

        {/* Dropdown Menu */}
        <ChatHeaderMenu
          isOpen={showMenu}
          position={dropdownPosition}
          onClose={() => setShowMenu(false)}
          messages={messages}
          totalMessages={totalMessages}
          hasMoreMessages={hasMoreMessages}
          conversationId={conversationId}
          exporting={exporting}
          onExport={handleExport}
          onPostInstructions={() => setShowPostInstructions(true)}
          onOpenLibraryCard={handleOpenLibraryCard}
          onUnmatch={onUnmatch}
        />

        {/* Character Info Overlay */}
        {collapsed ? (
          // Compact mode
          <div className="absolute bottom-0 left-0 right-0 px-6 py-3 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-3 h-3 ${getStatusColor(characterStatus.status)} rounded-full shadow-lg`}>
                  <div className={`absolute inset-0 ${getStatusColor(characterStatus.status)} rounded-full animate-ping opacity-75`}></div>
                </div>
              </div>
              <h2 className="text-lg font-bold drop-shadow-2xl">{character.name}</h2>
              <CharacterStatusBar
                characterStatus={characterStatus}
                characterMood={characterMood}
                characterState={characterState}
                upcomingActivities={upcomingActivities}
                showMood={showMood}
                showState={showState}
                onMoodClick={() => setShowMoodModal(true)}
                compact={true}
              />
            </div>
          </div>
        ) : (
          // Full mode
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <div className="flex items-end gap-4">
              {/* Avatar */}
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
                <div className={`absolute bottom-1 right-1 w-5 h-5 ${getStatusColor(characterStatus.status)} border-3 border-white rounded-full shadow-xl`}>
                  <div className={`absolute inset-0 ${getStatusColor(characterStatus.status)} rounded-full animate-ping opacity-75`}></div>
                </div>
              </div>
              <div className="flex-1 pb-2">
                <h2 className="text-2xl font-bold drop-shadow-2xl mb-1">{character.name}</h2>
                <CharacterStatusBar
                  characterStatus={characterStatus}
                  characterMood={characterMood}
                  characterState={characterState}
                  upcomingActivities={upcomingActivities}
                  showMood={showMood}
                  showState={showState}
                  onMoodClick={() => setShowMoodModal(true)}
                  compact={false}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
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

      <PostInstructionsModal
        isOpen={showPostInstructions}
        onClose={() => setShowPostInstructions(false)}
        characterId={character.id}
        characterName={character.name}
        onSave={(instructions) => {
          console.log('✅ Post instructions saved:', instructions);
        }}
      />

      <CharacterMoodModal
        isOpen={showMoodModal}
        onClose={() => setShowMoodModal(false)}
        characterId={character.id}
        characterName={character.name}
        currentMood={characterMood}
        onSave={handleSaveMood}
      />

      {/* Library Card Modal - rendered via portal to escape stacking context */}
      {showLibraryCard && createPortal(
        <CharacterProfile
          character={character}
          onClose={() => setShowLibraryCard(false)}
          mode="library"
        />,
        document.body
      )}
    </div>
  );
};

export default ChatHeader;
