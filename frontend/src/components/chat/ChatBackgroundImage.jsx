/**
 * Horizontal background image display with:
 * - Full-screen blurred background image
 * - Floating controls (auto-scroll toggle, hide)
 * - Show button when hidden
 */
const ChatBackgroundImage = ({
  showAsBackground,
  currentDisplayImage,
  backgroundHidden,
  setBackgroundHidden,
  autoScrollEnabled,
  setAutoScrollEnabled,
  receivedImages,
  currentImageIndex,
  character,
}) => {
  if (!showAsBackground || !character) return null;

  return (
    <>
      {/* Background Image */}
      {currentDisplayImage && !backgroundHidden && (
        <div className="absolute inset-0 z-0">
          <img
            src={currentDisplayImage}
            alt=""
            className="w-full h-full object-cover transition-opacity duration-500"
            style={{
              filter: 'brightness(0.4) blur(1px)',
              imageRendering: 'auto',
              transform: 'translateZ(0)',
            }}
          />
          {/* Gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/50"></div>
        </div>
      )}

      {/* Floating controls for horizontal background */}
      {currentDisplayImage && !backgroundHidden && (
        <div className="absolute bottom-36 right-8 flex flex-col gap-2 z-20">
          {/* Auto-scroll Toggle */}
          {receivedImages.length > 0 && (
            <button
              onClick={() => setAutoScrollEnabled(!autoScrollEnabled)}
              className={`p-2.5 backdrop-blur-md rounded-lg transition-all shadow-lg border border-white/20 ${
                autoScrollEnabled
                  ? 'bg-purple-500/80 hover:bg-purple-600/80'
                  : 'bg-black/40 hover:bg-black/60'
              }`}
              title={autoScrollEnabled ? `Auto-scroll ON (${currentImageIndex + 1}/${receivedImages.length})` : `Enable auto-scroll (${receivedImages.length} images)`}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {autoScrollEnabled ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
            </button>
          )}
          {/* Hide Background Button */}
          <button
            onClick={() => setBackgroundHidden(true)}
            className="p-2.5 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-lg transition-all shadow-lg border border-white/20"
            title="Hide background image"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          </button>
        </div>
      )}

      {/* Show Background Button (when hidden) */}
      {backgroundHidden && (
        <button
          onClick={() => setBackgroundHidden(false)}
          className="absolute bottom-36 right-8 z-20 p-2.5 bg-white/90 dark:bg-gray-800/90 hover:bg-purple-100 dark:hover:bg-gray-700 backdrop-blur-md rounded-lg transition-all shadow-lg border border-purple-200/50 dark:border-gray-600/50"
          title="Show background image"
        >
          <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      )}
    </>
  );
};

export default ChatBackgroundImage;
