import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import characterService from '../services/characterService';

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

      // Update character in IndexedDB
      const updatedCardData = {
        ...character.cardData,
        data: {
          ...character.cardData.data,
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

      // Update character in IndexedDB
      const updatedCardData = {
        ...character.cardData,
        data: {
          ...character.cardData.data,
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
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header with Image */}
        <div className="relative h-64 bg-gray-200 flex-shrink-0">
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
          <div className="p-6 border-b">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{character.name}</h2>
            {data.tags && data.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="border-b">
            <div className="flex gap-2 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 font-medium transition ${
                    activeTab === tab.id
                      ? 'text-purple-600 border-b-2 border-purple-600'
                      : 'text-gray-600 hover:text-gray-900'
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
              <div className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Dating Profile</h3>
                  <button
                    onClick={handleGenerateDatingProfile}
                    disabled={loading || !data.description}
                    className="px-3 py-1 text-sm bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {loading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Generate Profile
                      </>
                    )}
                  </button>
                </div>

                {data.datingProfile ? (
                  <div className="space-y-5">
                    {/* Bio */}
                    {data.datingProfile.bio && (
                      <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl p-4 border border-purple-200">
                        <h4 className="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          About Me
                        </h4>
                        <p className="text-gray-800 leading-relaxed">{data.datingProfile.bio}</p>
                      </div>
                    )}

                    {/* Age & Occupation */}
                    {(data.datingProfile.age || data.datingProfile.occupation) && (
                      <div className="flex gap-3">
                        {data.datingProfile.age && (
                          <div className="flex-1 bg-blue-50 rounded-lg p-3 border border-blue-200">
                            <div className="text-xs font-semibold text-blue-600 mb-1">Age</div>
                            <div className="text-lg font-bold text-blue-900">{data.datingProfile.age}</div>
                          </div>
                        )}
                        {data.datingProfile.occupation && (
                          <div className="flex-1 bg-green-50 rounded-lg p-3 border border-green-200">
                            <div className="text-xs font-semibold text-green-600 mb-1">Occupation</div>
                            <div className="text-sm font-semibold text-green-900">{data.datingProfile.occupation}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Physical Stats */}
                    {(data.datingProfile.height || data.datingProfile.bodyType || data.datingProfile.measurements) && (
                      <div className="flex gap-3">
                        {data.datingProfile.height && (
                          <div className="flex-1 bg-purple-50 rounded-lg p-3 border border-purple-200">
                            <div className="text-xs font-semibold text-purple-600 mb-1">Height</div>
                            <div className="text-lg font-bold text-purple-900">{data.datingProfile.height}</div>
                          </div>
                        )}
                        {data.datingProfile.bodyType && (
                          <div className="flex-1 bg-pink-50 rounded-lg p-3 border border-pink-200">
                            <div className="text-xs font-semibold text-pink-600 mb-1">Body Type</div>
                            <div className="text-sm font-semibold text-pink-900 capitalize">{data.datingProfile.bodyType}</div>
                          </div>
                        )}
                        {data.datingProfile.measurements && (
                          <div className="flex-1 bg-rose-50 rounded-lg p-3 border border-rose-200">
                            <div className="text-xs font-semibold text-rose-600 mb-1">Measurements</div>
                            <div className="text-sm font-semibold text-rose-900">{data.datingProfile.measurements}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Interests */}
                    {data.datingProfile.interests && data.datingProfile.interests.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                          Interests
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {data.datingProfile.interests.map((interest, index) => (
                            <span
                              key={index}
                              className="px-3 py-1.5 bg-gradient-to-r from-pink-100 to-purple-100 text-purple-800 rounded-full text-sm font-medium border border-purple-200"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fun Facts */}
                    {data.datingProfile.funFacts && data.datingProfile.funFacts.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Fun Facts
                        </h4>
                        <ul className="space-y-2">
                          {data.datingProfile.funFacts.map((fact, index) => (
                            <li key={index} className="flex items-start gap-2 text-gray-700">
                              <span className="text-pink-500 mt-1">•</span>
                              <span>{fact}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Looking For */}
                    {data.datingProfile.lookingFor && (
                      <div className="bg-pink-50 rounded-xl p-4 border border-pink-200">
                        <h4 className="text-sm font-semibold text-pink-900 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          Looking For
                        </h4>
                        <p className="text-gray-800">{data.datingProfile.lookingFor}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-gray-500 italic mb-3">No dating profile yet. Generate one to make this character more realistic!</p>
                    <p className="text-sm text-gray-400">The profile will be written in first-person, as if the character wrote it themselves.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Weekly Schedule</h3>
                  <button
                    onClick={handleGenerateSchedule}
                    disabled={loading || !data.description}
                    className="px-3 py-1 text-sm bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {loading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Generate Schedule
                      </>
                    )}
                  </button>
                </div>

                {data.schedule?.schedule ? (
                  <div className="space-y-4">
                    {Object.entries(data.schedule.schedule).map(([day, blocks]) => (
                      <div key={day} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2">
                          <h4 className="font-semibold text-white capitalize">{day}</h4>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {blocks.map((block, index) => (
                            <div key={index} className="px-4 py-3 flex items-center gap-4">
                              <div className="flex items-center gap-2 text-sm text-gray-600 font-medium min-w-[120px]">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {block.start} - {block.end}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  block.status === 'online' ? 'bg-green-100 text-green-700' :
                                  block.status === 'away' ? 'bg-yellow-100 text-yellow-700' :
                                  block.status === 'busy' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {block.status}
                                </span>
                                {block.activity && (
                                  <span className="text-sm text-gray-600">• {block.activity}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-500 italic mb-3">No schedule yet. Generate one to make this character feel more alive!</p>
                    <p className="text-sm text-gray-400">The schedule will determine when the character is online, away, busy, or offline.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'overview' && (
              <div className="space-y-6">
                {data.description && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">Description</h3>
                      <button
                        onClick={handleCleanupDescription}
                        disabled={loading}
                        className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {loading ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Cleaning...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Cleanup with AI
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{data.description}</p>
                  </div>
                )}

                {data.creator && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 mb-1">Creator</h3>
                    <p className="text-gray-700">{data.creator}</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-t p-4 bg-gray-50 flex gap-3 flex-shrink-0">
          {/* Show Start Chat if character is liked */}
          {character.isLiked && (
            <>
              <button
                onClick={() => {
                  onClose();
                  navigate(`/chat/${character.id}`);
                }}
                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
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
                  className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
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

          {/* Show Like/Pass buttons if callbacks provided */}
          {(onLike || onPass) && !character.isLiked && (
            <>
              {onPass && (
                <button
                  onClick={() => {
                    onPass();
                    onClose();
                  }}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Pass
                </button>
              )}
              {onLike && (
                <button
                  onClick={() => {
                    onLike();
                    onClose();
                  }}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Like
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
