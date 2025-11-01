const EmptyCardStack = ({ totalCount, onGoToLibrary, onReset }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 rounded-2xl shadow-2xl">
      <div className="text-center p-8">
        {totalCount === 0 ? (
          <>
            <svg
              className="w-24 h-24 mx-auto text-gray-300 dark:text-gray-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-2xl text-gray-400 dark:text-gray-300 mb-2">No characters yet!</p>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Upload some character cards to start swiping</p>
            <button
              onClick={onGoToLibrary}
              className="bg-purple-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-purple-600 transition-colors"
            >
              Go to Library
            </button>
          </>
        ) : (
          <>
            <p className="text-2xl text-gray-400 dark:text-gray-300 mb-4">All done!</p>
            <p className="text-gray-500 dark:text-gray-400 mb-4">You've swiped through all characters</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={onReset}
                className="bg-purple-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-purple-600 transition-colors"
              >
                Reload
              </button>
              <button
                onClick={onGoToLibrary}
                className="bg-blue-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-600 transition-colors"
              >
                Library
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmptyCardStack;
