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
              return (
                <div
                  key={index}
                  className="aspect-square rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all group"
                  onClick={() => onSelectImage({ url: fullUrl, prompt })}
                >
                  <img
                    src={fullUrl}
                    alt={`Image ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
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
