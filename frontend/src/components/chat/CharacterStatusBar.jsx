import { useState } from 'react';
import ScheduleDropdown from './ScheduleDropdown';

// Format state ID to display name (capitalize words, replace underscores)
const formatStateName = (stateId) => {
  if (!stateId) return '';
  return stateId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Displays character status, mood, and state badges
 */
const CharacterStatusBar = ({
  characterStatus,
  characterMood,
  characterState,
  upcomingActivities,
  showMood,
  showState,
  onMoodClick,
  onStateClick,
  compact = false
}) => {
  const [showSchedule, setShowSchedule] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });

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
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `until ${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const formatTime = (timeString) => {
    if (!timeString) return null;
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const handleScheduleClick = (e) => {
    e.stopPropagation();
    if (!showSchedule) {
      const rect = e.currentTarget.getBoundingClientRect();
      setDropdownPosition({ x: rect.left, y: rect.bottom + 8 });
    }
    setShowSchedule(!showSchedule);
  };

  const statusButtonClass = compact
    ? "text-xs font-semibold drop-shadow-lg capitalize bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/20 hover:bg-black/30 transition-all cursor-pointer flex items-center gap-1"
    : "text-sm font-semibold drop-shadow-lg capitalize bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20 hover:bg-black/30 transition-all cursor-pointer flex items-center gap-1";

  return (
    <div className="flex items-center gap-2">
      {/* Status Button with Schedule Dropdown */}
      <div className="relative">
        <button
          onClick={handleScheduleClick}
          className={statusButtonClass}
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

        <ScheduleDropdown
          isOpen={showSchedule}
          position={dropdownPosition}
          onClose={() => setShowSchedule(false)}
          activities={upcomingActivities}
          getStatusColor={getStatusColor}
          formatTime={formatTime}
        />
      </div>

      {/* Character Mood */}
      {showMood && (
        <button
          onClick={onMoodClick}
          className="text-xs font-semibold drop-shadow-lg bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/20 italic text-white/70 hover:bg-black/30 hover:border-white/30 transition-all cursor-pointer"
          title="Click to edit mood"
        >
          {characterMood}
        </button>
      )}

      {/* Character State */}
      {showState && (
        <button
          onClick={onStateClick}
          className="text-xs font-semibold drop-shadow-lg bg-orange-500/30 backdrop-blur-sm px-2 py-0.5 rounded-full border border-orange-300/40 text-orange-100 hover:bg-orange-500/40 hover:border-orange-300/60 transition-all cursor-pointer"
          title="Click to edit state"
        >
          {formatStateName(characterState)}
        </button>
      )}
    </div>
  );
};

export default CharacterStatusBar;
