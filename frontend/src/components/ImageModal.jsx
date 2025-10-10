import { useEffect } from 'react';

/**
 * Modal for displaying full-size images with prompt details
 */
const ImageModal = ({ imageUrl, imagePrompt, onClose }) => {
  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-w-[90vw] h-[95vh] flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all hover:scale-110 z-10"
          title="Close (Esc)"
        >
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image */}
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <img
            src={imageUrl}
            alt="AI-generated character image"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </div>

        {/* Prompt details */}
        {imagePrompt && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-5 max-h-[25vh] overflow-auto custom-scrollbar flex-shrink-0">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Image Prompt
            </h3>
            <p className="text-white/90 text-base font-mono leading-relaxed break-words">
              {imagePrompt}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageModal;
