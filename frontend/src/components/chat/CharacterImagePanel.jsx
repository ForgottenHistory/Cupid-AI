/**
 * Left side character image panel with:
 * - Character image display (base or auto-scroll through received images)
 * - Thought bubble overlay
 * - Hover controls (auto-scroll toggle, hide panel)
 * - Character name overlay with gallery button
 */
const CharacterImagePanel = ({
  character,
  currentThought,
  showCharacterImage,
  setShowCharacterImage,
  autoScrollEnabled,
  setAutoScrollEnabled,
  currentImageIndex,
  receivedImages,
  showAsBackground,
  onOpenGallery,
}) => {
  if (!character) return null;

  // When showing horizontal as background, use base image in panel
  const displayImage = showAsBackground
    ? character.imageUrl
    : (autoScrollEnabled && receivedImages.length > 0
        ? receivedImages[currentImageIndex]
        : character.imageUrl);

  return (
    <>
      {/* Character Image Panel */}
      <div
        className={`relative overflow-hidden rounded-2xl shadow-2xl flex-shrink-0 border border-purple-200/30 dark:border-gray-600/30 group transition-all duration-300 ease-in-out ${
          showCharacterImage ? 'w-[320px] opacity-100' : 'w-0 opacity-0 border-0'
        }`}
      >
        {/* Image with gradient overlays for depth */}
        <div className="absolute inset-0">
          <img
            src={displayImage}
            alt={character.name}
            className="w-full h-full object-cover object-center transition-opacity duration-500"
            style={{
              imageRendering: 'auto',
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden'
            }}
          />
          {/* Top gradient fade */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/50 via-black/20 to-transparent"></div>
          {/* Gradient overlays for sleek blending */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-purple-50/20 dark:to-gray-800/30"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10 dark:to-black/30"></div>
          {/* Subtle vignette effect */}
          <div className="absolute inset-0 shadow-inner" style={{
            boxShadow: 'inset 0 0 100px rgba(0,0,0,0.1)'
          }}></div>
        </div>

        {/* Thought Display - Top Left */}
        {currentThought && (
          <div className="absolute top-4 left-4 max-w-[240px] animate-fade-in">
            <div className="bg-black/60 backdrop-blur-md rounded-lg px-3 py-2 shadow-xl border border-white/10">
              <div className="flex items-start gap-2">
                <span className="text-base opacity-60">💭</span>
                <p className="text-xs text-white/90 leading-relaxed italic">
                  {currentThought}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Control Buttons - Top Right */}
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
          {/* Auto-scroll Toggle Button */}
          {receivedImages.length > 0 && (
            <button
              onClick={() => setAutoScrollEnabled(!autoScrollEnabled)}
              className={`p-2 backdrop-blur-sm rounded-lg transition-all shadow-lg ${
                autoScrollEnabled
                  ? 'bg-purple-500/80 hover:bg-purple-600/80'
                  : 'bg-black/40 hover:bg-black/60'
              }`}
              title={autoScrollEnabled ? `Auto-scroll ON (${receivedImages.length} images)` : `Enable auto-scroll (${receivedImages.length} images)`}
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {autoScrollEnabled ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
            </button>
          )}

          {/* Hide Image Button */}
          <button
            onClick={() => setShowCharacterImage(false)}
            className="p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-lg transition-all shadow-lg"
            title="Hide character image"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Character name overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32">
          {/* Blur layer with gradual fade */}
          <div className="absolute inset-0 backdrop-blur-sm" style={{
            maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0) 100%)'
          }}></div>
          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-40% via-black/20 to-transparent"></div>
          {/* Text */}
          <div className="absolute bottom-5 left-5 right-5">
            <h2 className="text-xl font-bold text-white drop-shadow-lg">{character.name}</h2>
            {/* Auto-scroll indicator / Gallery button */}
            {autoScrollEnabled && receivedImages.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={onOpenGallery}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/80 hover:bg-purple-600/90 backdrop-blur-sm rounded-full text-xs font-medium text-white shadow-lg transition-all cursor-pointer"
                  title="View all images"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                    <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{currentImageIndex + 1} / {receivedImages.length}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Show Image Button (when panel is hidden) */}
      {!showCharacterImage && (
        <button
          onClick={() => setShowCharacterImage(true)}
          className="w-12 flex-shrink-0 bg-white dark:bg-gray-800 border border-purple-200/30 dark:border-gray-600/30 rounded-xl shadow-lg hover:bg-purple-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center animate-fade-in"
          title="Show character image"
        >
          <svg
            className="w-6 h-6 text-purple-600 dark:text-purple-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </>
  );
};

export default CharacterImagePanel;
