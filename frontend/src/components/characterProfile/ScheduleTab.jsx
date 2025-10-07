import GenerateButton from '../shared/GenerateButton';
import EmptyState from '../shared/EmptyState';

const ScheduleTab = ({ data, loading, onGenerate }) => {
  const icon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Weekly Schedule</h3>
        <GenerateButton
          onClick={onGenerate}
          loading={loading}
          disabled={!data.description}
          label="Generate Schedule"
          icon={icon}
          gradient="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
        />
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
        <EmptyState
          icon={
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          title="No schedule yet. Generate one to make this character feel more alive!"
          description="The schedule will determine when the character is online, away, busy, or offline."
        />
      )}
    </div>
  );
};

export default ScheduleTab;
