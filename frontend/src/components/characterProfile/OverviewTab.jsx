const OverviewTab = ({ data, loading, onCleanup }) => {
  return (
    <div className="space-y-6">
      {data.description && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Description</h3>
            <button
              onClick={onCleanup}
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
  );
};

export default OverviewTab;
