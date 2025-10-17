import { useState, useEffect } from 'react';
import GenerateButton from '../shared/GenerateButton';
import EmptyState from '../shared/EmptyState';

const ScheduleTab = ({ data, loading, onGenerate, onRevert, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSchedule, setEditedSchedule] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [loadingDays, setLoadingDays] = useState({}); // Track which days are being generated

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  // Initialize edited schedule from data
  useEffect(() => {
    if (data.schedule?.schedule) {
      setEditedSchedule(JSON.parse(JSON.stringify(data.schedule.schedule)));
      setHasChanges(false);
    }
  }, [data.schedule]);

  const icon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const handleRevert = () => {
    if (confirm('Are you sure you want to revert to the previous schedule?')) {
      onRevert();
    }
  };

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedSchedule(JSON.parse(JSON.stringify(data.schedule.schedule)));
    setHasChanges(false);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (onSave) {
      const updatedScheduleData = {
        ...data.schedule,
        schedule: editedSchedule
      };
      onSave(updatedScheduleData);
      setHasChanges(false);
      setIsEditing(false);
    }
  };

  const handleBlockChange = (day, blockIndex, field, value) => {
    const newSchedule = { ...editedSchedule };
    newSchedule[day][blockIndex][field] = value;
    setEditedSchedule(newSchedule);
    setHasChanges(true);
  };

  const handleAddBlock = (day) => {
    const newSchedule = { ...editedSchedule };
    const lastBlock = newSchedule[day][newSchedule[day].length - 1];
    const newBlock = {
      start: lastBlock?.end || '00:00',
      end: '23:59',
      status: 'online',
      activity: ''
    };
    newSchedule[day].push(newBlock);
    setEditedSchedule(newSchedule);
    setHasChanges(true);
  };

  const handleDeleteBlock = (day, blockIndex) => {
    const newSchedule = { ...editedSchedule };
    newSchedule[day].splice(blockIndex, 1);
    setEditedSchedule(newSchedule);
    setHasChanges(true);
  };

  const handleGenerateDay = async (day) => {
    setLoadingDays(prev => ({ ...prev, [day]: true }));
    try {
      await onGenerate(day); // Pass day to parent handler
    } finally {
      setLoadingDays(prev => ({ ...prev, [day]: false }));
    }
  };

  const displaySchedule = isEditing ? editedSchedule : data.schedule?.schedule;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Weekly Schedule</h3>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancelEdit}
                disabled={loading}
                className="px-3 py-1 text-sm bg-gray-500 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={loading || !hasChanges}
                className="px-3 py-1 text-sm bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Changes
              </button>
            </>
          ) : (
            <>
              {data.schedule && (
                <button
                  onClick={handleStartEdit}
                  disabled={loading}
                  className="px-3 py-1 text-sm bg-purple-500 dark:bg-purple-600 hover:bg-purple-600 dark:hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              )}
              {data.previousSchedule && data.schedule && (
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
                label="Generate Schedule"
                icon={icon}
                gradient="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              />
            </>
          )}
        </div>
      </div>

      {displaySchedule ? (
        <div className="space-y-4">
          {Object.entries(displaySchedule).map(([day, blocks]) => (
            <div key={day} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 px-4 py-2 flex justify-between items-center">
                <h4 className="font-semibold text-white capitalize">{day}</h4>
                <div className="flex items-center gap-2">
                  {!isEditing && !loading && (
                    <button
                      onClick={() => handleGenerateDay(day)}
                      disabled={loadingDays[day] || !data.description}
                      className="text-white hover:bg-white/20 rounded px-2 py-1 text-xs flex items-center gap-1 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingDays[day] ? (
                        <>
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {blocks.length > 0 ? 'Regenerate' : 'Generate'}
                        </>
                      )}
                    </button>
                  )}
                  {isEditing && (
                    <button
                      onClick={() => handleAddBlock(day)}
                      className="text-white hover:bg-white/20 rounded px-2 py-1 text-xs flex items-center gap-1 transition"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Block
                    </button>
                  )}
                </div>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {blocks.map((block, index) => (
                  <div key={index} className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={block.start}
                            onChange={(e) => handleBlockChange(day, index, 'start', e.target.value)}
                            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                          <span className="text-gray-500">-</span>
                          <input
                            type="time"
                            value={block.end}
                            onChange={(e) => handleBlockChange(day, index, 'end', e.target.value)}
                            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        <select
                          value={block.status}
                          onChange={(e) => handleBlockChange(day, index, 'status', e.target.value)}
                          className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          <option value="online">Online</option>
                          <option value="away">Away</option>
                          <option value="busy">Busy</option>
                          <option value="offline">Offline</option>
                        </select>
                        <input
                          type="text"
                          value={block.activity || ''}
                          onChange={(e) => handleBlockChange(day, index, 'activity', e.target.value)}
                          placeholder="Activity (optional)"
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                        <button
                          onClick={() => handleDeleteBlock(day, index)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                          title="Delete block"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-medium min-w-[120px]">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {block.start} - {block.end}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            block.status === 'online' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                            block.status === 'away' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                            block.status === 'busy' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                            'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}>
                            {block.status}
                          </span>
                          {block.activity && (
                            <span className="text-sm text-gray-600 dark:text-gray-400">• {block.activity}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <EmptyState
            icon={
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            title="No schedule yet. Generate one to make this character feel more alive!"
            description="The schedule will determine when the character is online, away, busy, or offline."
          />

          {data.description && (
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Generate by day:</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {days.map(day => (
                  <button
                    key={day}
                    onClick={() => handleGenerateDay(day)}
                    disabled={loadingDays[day] || !data.description}
                    className="px-3 py-2 text-sm bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    {loadingDays[day] ? (
                      <>
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        ...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScheduleTab;
