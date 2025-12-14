const SwipeActionButtons = ({ onPass, onUndo, onLike, canUndo, disabled }) => {
  return (
    <div className="flex justify-center gap-6">
      <button
        onClick={onPass}
        disabled={disabled}
        className="bg-red-500 text-white w-16 h-16 rounded-full shadow-lg hover:bg-red-600 transition-all hover:scale-110 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <button
        onClick={onUndo}
        disabled={!canUndo || disabled}
        className="bg-yellow-500 text-white w-16 h-16 rounded-full shadow-lg hover:bg-yellow-600 transition-all hover:scale-110 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>

      <button
        onClick={onLike}
        disabled={disabled}
        className="bg-green-500 text-white w-16 h-16 rounded-full shadow-lg hover:bg-green-600 transition-all hover:scale-110 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>
    </div>
  );
};

export default SwipeActionButtons;
