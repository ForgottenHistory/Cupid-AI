import { createPortal } from 'react-dom';

/**
 * Dropdown showing upcoming schedule activities
 */
const ScheduleDropdown = ({
  isOpen,
  position,
  onClose,
  activities,
  getStatusColor,
  formatTime
}) => {
  if (!isOpen || activities.length === 0) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[998]"
        onClick={onClose}
      />
      <div
        className="fixed bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-purple-100/50 dark:border-purple-900/50 rounded-xl shadow-xl py-2 min-w-[280px] z-[999]"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`
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
          {activities.map((activity, index) => (
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
  );
};

export default ScheduleDropdown;
