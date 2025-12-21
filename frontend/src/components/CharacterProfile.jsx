import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import characterService from '../services/characterService';
import ProfileTab from './characterProfile/ProfileTab';
import ScheduleTab from './characterProfile/ScheduleTab';
import PersonalityTab from './characterProfile/PersonalityTab';
import VoiceTab from './characterProfile/VoiceTab';
import ImageTab from './characterProfile/ImageTab';
import OverviewTab from './characterProfile/OverviewTab';

const CharacterProfile = ({ character, onClose, onLike, onPass, onUnlike, onUpdate, mode = 'library' }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [editedTags, setEditedTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const navigate = useNavigate();

  if (!character) return null;

  const data = character.cardData?.data || {};

  // In discover mode, only show Dating Profile tab
  const tabs = mode === 'discover'
    ? [{ id: 'profile', label: 'Dating Profile' }]
    : [
        { id: 'profile', label: 'Dating Profile' },
        { id: 'schedule', label: 'Schedule' },
        { id: 'personality', label: 'Personality' },
        { id: 'image', label: 'Image' },
        { id: 'overview', label: 'Overview' },
      ];

  const handleStartEditingName = () => {
    setEditedName(character.name || '');
    setIsEditingName(true);
  };

  const handleCancelEditingName = () => {
    setIsEditingName(false);
    setEditedName('');
    setError('');
  };

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      setError('Name cannot be empty');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const trimmedName = editedName.trim();

      // Update both top-level name AND cardData.data.name
      const updatedCardData = {
        ...character.cardData,
        data: {
          ...character.cardData.data,
          name: trimmedName
        }
      };

      await characterService.updateCharacterData(character.id, {
        name: trimmedName,
        cardData: updatedCardData
      });

      // Notify parent of update
      if (onUpdate) {
        onUpdate();
      }

      setIsEditingName(false);
    } catch (err) {
      console.error('Save name error:', err);
      setError('Failed to save name');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditingTags = () => {
    setEditedTags(data.tags || []);
    setNewTag('');
    setIsEditingTags(true);
  };

  const handleCancelEditingTags = () => {
    setIsEditingTags(false);
    setEditedTags([]);
    setNewTag('');
    setError('');
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    if (editedTags.includes(newTag.trim())) {
      setError('Tag already exists');
      return;
    }
    setEditedTags([...editedTags, newTag.trim()]);
    setNewTag('');
    setError('');
  };

  const handleRemoveTag = (tagToRemove) => {
    setEditedTags(editedTags.filter(tag => tag !== tagToRemove));
  };

  const handleSaveTags = async () => {
    setLoading(true);
    setError('');

    try {
      // Update character in backend
      const updatedCardData = {
        ...character.cardData,
        data: {
          ...character.cardData.data,
          tags: editedTags
        }
      };

      await characterService.updateCharacterData(character.id, {
        cardData: updatedCardData
      });

      // Notify parent of update
      if (onUpdate) {
        onUpdate();
      }

      setIsEditingTags(false);
    } catch (err) {
      console.error('Save tags error:', err);
      setError('Failed to save tags');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupDescription = async () => {
    if (!data.description) {
      setError('No description to cleanup');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cleanedDescription = await characterService.cleanupDescription(data.description);

      // Update character in backend, storing original as backup for revert
      const updatedCardData = {
        ...character.cardData,
        data: {
          ...character.cardData.data,
          originalDescription: data.originalDescription || data.description, // Save original (keep existing if already set)
          description: cleanedDescription
        }
      };

      await characterService.updateCharacterData(character.id, {
        cardData: updatedCardData
      });

      // Notify parent of update
      if (onUpdate) {
        onUpdate();
      }

      alert('Description cleaned successfully!');
    } catch (err) {
      console.error('Cleanup error:', err);
      setError(err.response?.data?.error || 'Failed to cleanup description');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDatingProfile = async () => {
    if (!data.description) {
      setError('Need a description to generate dating profile');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const profile = await characterService.generateDatingProfile(
        data.description,
        character.name
      );

      // Update character in backend, storing previous as backup
      const updatedCardData = {
        ...character.cardData,
        data: {
          ...character.cardData.data,
          previousDatingProfile: data.datingProfile, // Save current as previous
          datingProfile: profile
        }
      };

      await characterService.updateCharacterData(character.id, {
        cardData: updatedCardData
      });

      // Notify parent of update
      if (onUpdate) {
        onUpdate();
      }

      alert('Dating profile generated successfully!');
    } catch (err) {
      console.error('Generate dating profile error:', err);
      setError(err.response?.data?.error || 'Failed to generate dating profile');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSchedule = async (day = null) => {
    if (!data.description) {
      setError('Need a description to generate schedule');
      return;
    }

    // Prompt user for extra instructions
    const extraInstructions = prompt(
      'Any extra instructions for the schedule? (optional)\n\n' +
      'Examples:\n' +
      '- "Make them more socially active"\n' +
      '- "Include gaming as a hobby"\n' +
      '- "Less NSFW content"\n' +
      '- "More variety in activities"'
    );

    setLoading(true);
    setError('');

    try {
      const schedule = await characterService.generateSchedule(
        data.description,
        character.name,
        day,
        extraInstructions
      );

      // If generating a specific day, merge with existing schedule
      let finalSchedule = schedule;
      if (day && data.schedule?.schedule) {
        finalSchedule = {
          ...data.schedule,
          schedule: {
            ...data.schedule.schedule,
            ...schedule.schedule
          }
        };
      }

      // Update character in backend, storing previous as backup (only when generating full week)
      const updatedCardData = {
        ...character.cardData,
        data: {
          ...character.cardData.data,
          previousSchedule: !day ? data.schedule : data.previousSchedule, // Only save previous when generating full week
          schedule: finalSchedule
        }
      };

      await characterService.updateCharacterData(character.id, {
        cardData: updatedCardData
      });

      // Notify parent of update
      if (onUpdate) {
        onUpdate();
      }

      alert(day ? `${day.charAt(0) + day.slice(1).toLowerCase()} schedule generated!` : 'Schedule generated successfully!');
    } catch (err) {
      console.error('Generate schedule error:', err);
      setError(err.response?.data?.error || 'Failed to generate schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePersonality = async () => {
    if (!data.description) {
      setError('Need a description to generate personality');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const personality = await characterService.generatePersonality(
        data.description,
        character.name,
        data.personality
      );

      // Update character in backend, storing previous as backup
      const updatedCardData = {
        ...character.cardData,
        data: {
          ...character.cardData.data,
          previousPersonalityTraits: data.personalityTraits, // Save current as previous
          personalityTraits: personality
        }
      };

      await characterService.updateCharacterData(character.id, {
        cardData: updatedCardData
      });

      // Notify parent of update
      if (onUpdate) {
        onUpdate();
      }

      alert('Personality traits generated successfully!');
    } catch (err) {
      console.error('Generate personality error:', err);
      setError(err.response?.data?.error || 'Failed to generate personality');
    } finally {
      setLoading(false);
    }
  };

  const handleEditDescription = async (newDescription) => {
    if (!newDescription || newDescription.trim() === '') {
      setError('Description cannot be empty');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Update character in backend
      const updatedCardData = {
        ...character.cardData,
        data: {
          ...character.cardData.data,
          description: newDescription
        }
      };

      await characterService.updateCharacterData(character.id, {
        cardData: updatedCardData
      });

      // Notify parent of update
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Edit description error:', err);
      setError(err.response?.data?.error || 'Failed to update description');
    } finally {
      setLoading(false);
    }
  };

  const handleRevertDescription = async () => {
    if (!data.originalDescription) {
      setError('No original description found');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Update character in backend - restore original description
      const updatedCardData = {
        ...character.cardData,
        data: {
          ...character.cardData.data,
          description: data.originalDescription
        }
      };

      await characterService.updateCharacterData(character.id, {
        cardData: updatedCardData
      });

      // Notify parent of update
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Revert description error:', err);
      setError(err.response?.data?.error || 'Failed to revert description');
    } finally {
      setLoading(false);
    }
  };

  const handleRevertDatingProfile = async () => {
    if (!data.previousDatingProfile) {
      setError('No previous dating profile found');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Restore previous dating profile
      const updatedCardData = {
        ...character.cardData,
        data: {
          ...character.cardData.data,
          datingProfile: data.previousDatingProfile
        }
      };

      await characterService.updateCharacterData(character.id, {
        cardData: updatedCardData
      });

      // Notify parent of update
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Revert dating profile error:', err);
      setError(err.response?.data?.error || 'Failed to revert dating profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchedule = async (updatedSchedule) => {
    setLoading(true);
    setError('');

    try {
      // Update character in backend, storing previous as backup
      const updatedCardData = {
        ...character.cardData,
        data: {
          ...character.cardData.data,
          previousSchedule: data.schedule, // Save current as previous
          schedule: updatedSchedule
        }
      };

      await characterService.updateCharacterData(character.id, {
        cardData: updatedCardData
      });

      // Notify parent of update
      if (onUpdate) {
        onUpdate();
      }

      alert('Schedule saved successfully!');
    } catch (err) {
      console.error('Save schedule error:', err);
      setError(err.response?.data?.error || 'Failed to save schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleRevertSchedule = async () => {
    if (!data.previousSchedule) {
      setError('No previous schedule found');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Restore previous schedule
      const updatedCardData = {
        ...character.cardData,
        data: {
          ...character.cardData.data,
          schedule: data.previousSchedule
        }
      };

      await characterService.updateCharacterData(character.id, {
        cardData: updatedCardData
      });

      // Notify parent of update
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Revert schedule error:', err);
      setError(err.response?.data?.error || 'Failed to revert schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleRevertPersonality = async () => {
    if (!data.previousPersonalityTraits) {
      setError('No previous personality found');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Restore previous personality
      const updatedCardData = {
        ...character.cardData,
        data: {
          ...character.cardData.data,
          personalityTraits: data.previousPersonalityTraits
        }
      };

      await characterService.updateCharacterData(character.id, {
        cardData: updatedCardData
      });

      // Notify parent of update
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Revert personality error:', err);
      setError(err.response?.data?.error || 'Failed to revert personality');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full h-[85vh] overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700 flex">
        {/* Left Side: Character Image */}
        <div className="relative w-72 flex-shrink-0 bg-gray-200 dark:bg-gray-700">
          <img
            src={character.imageUrl}
            alt={character.name}
            className="w-full h-full object-cover"
          />
          {/* Soft edge overlays for smooth transition */}
          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white dark:from-gray-800 to-transparent"></div>
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/80 dark:from-gray-800/80 to-transparent"></div>
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/60 dark:from-gray-800/60 to-transparent"></div>

          {character.isLiked && (
            <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                  clipRule="evenodd"
                />
              </svg>
              Liked
            </div>
          )}
        </div>

        {/* Right Side: Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header with Name & Tags */}
          <div className="p-5 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {/* Editable Name */}
                {isEditingName ? (
                  <div className="space-y-3 mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveName();
                          }
                        }}
                        placeholder="Character name..."
                        className="flex-1 text-xl font-bold bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 px-3 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={loading}
                        className="p-1.5 text-green-500 hover:bg-green-500/10 rounded-lg transition"
                        aria-label="Save name"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={handleCancelEditingName}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                        aria-label="Cancel"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-2 group">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{character.name}</h2>
                    {mode === 'library' && (
                      <button
                        onClick={handleStartEditingName}
                        className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition opacity-0 group-hover:opacity-100"
                        aria-label="Edit name"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}

                {/* Editable Tags */}
                {isEditingTags ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        placeholder="Add tag and press Enter..."
                        className="flex-1 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        onClick={handleSaveTags}
                        disabled={loading}
                        className="p-1.5 text-green-500 hover:bg-green-500/10 rounded-lg transition"
                        aria-label="Save tags"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={handleCancelEditingTags}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                        aria-label="Cancel"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {editedTags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium flex items-center gap-1"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-red-600 dark:hover:text-red-400 transition"
                            title="Remove tag"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    {data.tags && data.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {data.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">No tags</span>
                    )}
                    {mode === 'library' && (
                      <button
                        onClick={handleStartEditingTags}
                        className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition opacity-0 group-hover:opacity-100"
                        aria-label="Edit tags"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition flex-shrink-0"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Action Buttons Row */}
            {mode === 'library' && !isEditingName && !isEditingTags && (
              <div className="flex gap-2 mt-3">
                {character.isLiked ? (
                  onUnlike && (
                    <button
                      onClick={async () => {
                        if (window.confirm(`Are you sure you want to unmatch with ${character.name}?`)) {
                          try {
                            await onUnlike();
                          } catch (error) {
                            console.error('Unmatch failed:', error);
                          }
                        }
                      }}
                      className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Unmatch
                    </button>
                  )
                ) : (
                  onLike && (
                    <button
                      onClick={async () => {
                        try {
                          await onLike();
                        } catch (error) {
                          console.error('Like failed:', error);
                        }
                      }}
                      className="px-3 py-1.5 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Like
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex px-5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 font-medium text-sm transition ${
                    activeTab === tab.id
                      ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Tab Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            {activeTab === 'profile' && (
              <ProfileTab
                data={data}
                loading={loading}
                onGenerate={handleGenerateDatingProfile}
                onRevert={handleRevertDatingProfile}
              />
            )}

            {activeTab === 'schedule' && (
              <ScheduleTab
                data={data}
                loading={loading}
                onGenerate={handleGenerateSchedule}
                onRevert={handleRevertSchedule}
                onSave={handleSaveSchedule}
              />
            )}

            {activeTab === 'personality' && (
              <PersonalityTab
                data={data}
                loading={loading}
                onGenerate={handleGeneratePersonality}
                onRevert={handleRevertPersonality}
              />
            )}

            {activeTab === 'image' && (
              <ImageTab
                character={character}
                onUpdate={onUpdate}
              />
            )}

            {activeTab === 'overview' && (
              <OverviewTab
                data={data}
                loading={loading}
                onCleanup={handleCleanupDescription}
                onEdit={handleEditDescription}
                onRevert={handleRevertDescription}
              />
            )}
          </div>

          {/* Action Buttons */}
          {character.isLiked && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
              <button
                onClick={() => {
                  onClose();
                  navigate(`/chat/${character.id}`);
                }}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 dark:from-pink-600 dark:to-purple-700 hover:from-pink-600 hover:to-purple-700 dark:hover:from-pink-700 dark:hover:to-purple-800 text-white font-semibold py-3 rounded-lg transition shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Start Chat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CharacterProfile;
