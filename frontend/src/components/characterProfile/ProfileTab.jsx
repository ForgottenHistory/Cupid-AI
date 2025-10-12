import GenerateButton from '../shared/GenerateButton';
import EmptyState from '../shared/EmptyState';

const ProfileTab = ({ data, loading, onGenerate, onRevert }) => {
  const icon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );

  const handleRevert = () => {
    if (confirm('Are you sure you want to revert to the previous dating profile?')) {
      onRevert();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dating Profile</h3>
        <div className="flex gap-2">
          {data.previousDatingProfile && data.datingProfile && (
            <button
              onClick={handleRevert}
              disabled={loading}
              className="px-3 py-1 text-sm bg-orange-500 dark:bg-orange-600 hover:bg-orange-600 dark:hover:bg-orange-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Revert
            </button>
          )}
          <GenerateButton
            onClick={onGenerate}
            loading={loading}
            disabled={!data.description}
            label="Generate Profile"
            icon={icon}
            gradient="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
          />
        </div>
      </div>

      {data.datingProfile ? (
        <div className="space-y-5">
          {/* Bio */}
          {data.datingProfile.bio && (
            <div className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
              <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                About Me
              </h4>
              <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{data.datingProfile.bio}</p>
            </div>
          )}

          {/* Age & Occupation */}
          {(data.datingProfile.age || data.datingProfile.occupation) && (
            <div className="flex gap-3">
              {data.datingProfile.age && (
                <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Age</div>
                  <div className="text-lg font-bold text-blue-900 dark:text-blue-200">{data.datingProfile.age}</div>
                </div>
              )}
              {data.datingProfile.occupation && (
                <div className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-700">
                  <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">Occupation</div>
                  <div className="text-sm font-semibold text-green-900 dark:text-green-200">{data.datingProfile.occupation}</div>
                </div>
              )}
            </div>
          )}

          {/* Physical Stats */}
          {(data.datingProfile.height || data.datingProfile.bodyType || data.datingProfile.measurements) && (
            <div className="flex gap-3">
              {data.datingProfile.height && (
                <div className="flex-1 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                  <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">Height</div>
                  <div className="text-lg font-bold text-purple-900 dark:text-purple-200">{data.datingProfile.height}</div>
                </div>
              )}
              {data.datingProfile.bodyType && (
                <div className="flex-1 bg-pink-50 dark:bg-pink-900/20 rounded-lg p-3 border border-pink-200 dark:border-pink-700">
                  <div className="text-xs font-semibold text-pink-600 dark:text-pink-400 mb-1">Body Type</div>
                  <div className="text-sm font-semibold text-pink-900 dark:text-pink-200 capitalize">{data.datingProfile.bodyType}</div>
                </div>
              )}
              {data.datingProfile.measurements && (
                <div className="flex-1 bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3 border border-rose-200 dark:border-rose-700">
                  <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">Measurements</div>
                  <div className="text-sm font-semibold text-rose-900 dark:text-rose-200">{data.datingProfile.measurements}</div>
                </div>
              )}
            </div>
          )}

          {/* Interests */}
          {data.datingProfile.interests && data.datingProfile.interests.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Interests
              </h4>
              <div className="flex flex-wrap gap-2">
                {data.datingProfile.interests.map((interest, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 bg-gradient-to-r from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full text-sm font-medium border border-purple-200 dark:border-purple-700"
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
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Fun Facts
              </h4>
              <ul className="space-y-2">
                {data.datingProfile.funFacts.map((fact, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                    <span className="text-pink-500 dark:text-pink-400 mt-1">•</span>
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Looking For */}
          {data.datingProfile.lookingFor && (
            <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4 border border-pink-200 dark:border-pink-700">
              <h4 className="text-sm font-semibold text-pink-900 dark:text-pink-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Looking For
              </h4>
              <p className="text-gray-800 dark:text-gray-200">{data.datingProfile.lookingFor}</p>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="No dating profile yet. Generate one to make this character more realistic!"
          description="The profile will be written in first-person, as if the character wrote it themselves."
        />
      )}
    </div>
  );
};

export default ProfileTab;
