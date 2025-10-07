const GenerateButton = ({ onClick, loading, disabled, label, icon, gradient }) => {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`px-3 py-1 text-sm ${gradient} text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1`}
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
          {icon}
          {label}
        </>
      )}
    </button>
  );
};

export default GenerateButton;
