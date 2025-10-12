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
        { id: 'voice', label: 'Voice' },
        { id: 'image', label: 'Image' },
        { id: 'overview', label: 'Overview' },
      ];

  const handleCleanupDescription = async () => {
    if (!data.description) {
      setError('No description to cleanup');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cleanedDescription = await characterService.cleanupDescription(data.description);

      // Update character in IndexedDB
      const updatedCardData = {
        ...character.cardData,
        data: {
          ...character.cardData.data,
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

      // Update character in IndexedDB, storing previous as backup
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

  const handleGenerateSchedule = async () => {
    if (!data.description) {
      setError('Need a description to generate schedule');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const schedule = await characterService.generateSchedule(
        data.description,
        character.name
      );

      // Update character in IndexedDB, storing previous as backup
      const updatedCardData = {
        ...character.cardData,
        data: {
          ...character.cardData.data,
          previousSchedule: data.schedule, // Save current as previous
          schedule: schedule
        }
      };

      await characterService.updateCharacterData(character.id, {
        cardData: updatedCardData
      });

      // Notify parent of update
      if (onUpdate) {
        onUpdate();
      }

      alert('Schedule generated successfully!');
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

      // Update character in IndexedDB, storing previous as backup
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
      // Update character in IndexedDB
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
      // Update character in IndexedDB - restore original description
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
      onClick={(e) => {
        // Close if clicking the backdrop (not the modal content)
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header with Image */}
        <div className="relative h-64 bg-gray-200 dark:bg-gray-700 flex-shrink-0">
          <img
            src={character.imageUrl}
            alt={character.name}
            className="w-full h-full object-cover"
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

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

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Title & Tags */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{character.name}</h2>
            {data.tags && data.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-2 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 font-medium transition ${
                    activeTab === tab.id
                      ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
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

            {activeTab === 'voice' && (
              <VoiceTab
                character={character}
                onUpdate={onUpdate}
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
        </div>

        {/* Action Buttons */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50 flex gap-3 flex-shrink-0">
          {/* Show Start Chat if character is liked */}
          {character.isLiked && (
            <>
              <button
                onClick={() => {
                  onClose();
                  navigate(`/chat/${character.id}`);
                }}
                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 dark:from-pink-600 dark:to-purple-700 hover:from-pink-600 hover:to-purple-700 dark:hover:from-pink-700 dark:hover:to-purple-800 text-white font-semibold py-3 rounded-lg transition shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Start Chat
              </button>
              {/* Show Unmatch button in library mode or if onUnlike provided */}
              {onUnlike && (
                <button
                  onClick={() => {
                    onUnlike();
                    onClose();
                  }}
                  className="bg-gray-500 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
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
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CharacterProfile;
