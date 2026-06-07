import { getImageUrl } from '../../services/api';

/**
 * Image gallery overlay showing all images from a character.
 * Displays as a grid with click-to-enlarge functionality.
 */
const ImageGallery = ({
  isOpen,
  onClose,
  character,
  allImageUrls,
  onSelectImage,
  onToggleCarouselExclusion,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Gallery Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Back to chat"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Images from {character?.name}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{allImageUrls?.length || 0} images</p>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {allImageUrls && allImageUrls.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {allImageUrls.map((img, index) => {
              const fullUrl = getImageUrl(img.url || img);
              const prompt = img.prompt || null;
              const messageId = img.messageId;
              const excluded = !!img.excludedFromCarousel;
              return (
                <div
                  key={index}
                  className={`relative aspect-square rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all group ${
                    excluded ? 'opacity-50' : ''
                  }`}
                  onClick={() => onSelectImage({ url: fullUrl, prompt })}
                >
                  <img
                    src={fullUrl}
                    alt={`Image ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Carousel exclusion toggle */}
                  {messageId != null && onToggleCarouselExclusion && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleCarouselExclusion(messageId, !excluded);
                      }}
                      className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-sm shadow-lg transition-all opacity-0 group-hover:opacity-100 ${
                        excluded
                          ? 'bg-black/60 hover:bg-black/80 text-white opacity-100'
                          : 'bg-purple-500/80 hover:bg-purple-600/90 text-white'
                      }`}
                      title={excluded ? 'Hidden from carousel — click to show' : 'Shown in carousel — click to hide'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {excluded ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        ) : (
                          <>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </>
                        )}
                      </svg>
                    </button>
                  )}

                  {/* Excluded badge */}
                  {excluded && (
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-medium backdrop-blur-sm">
                      Hidden from carousel
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <p>No images yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageGallery;
