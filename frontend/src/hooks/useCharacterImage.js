import { useState, useEffect, useRef } from 'react';
import { getImageUrl } from '../services/api';

/**
 * Hook to manage character image display state including:
 * - Image panel visibility (persistent via localStorage)
 * - Auto-scroll mode for cycling through received images
 * - Image orientation detection for horizontal background mode
 * - Background visibility toggle
 */
export const useCharacterImage = (characterId, character, allImageUrls) => {
  // Character image panel visibility (persistent, default visible)
  const [showCharacterImage, setShowCharacterImage] = useState(() => {
    const saved = localStorage.getItem('chatShowCharacterImage');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Auto-scroll mode for character images
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const autoScrollIntervalRef = useRef(null);
  const hasAutoEnabledRef = useRef(false);

  // Image orientation detection
  const [isHorizontalImage, setIsHorizontalImage] = useState(false);

  // Setting: show horizontal images as background (from localStorage)
  const [horizontalAsBackground, setHorizontalAsBackground] = useState(() => {
    const saved = localStorage.getItem('chatHorizontalAsBackground');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Temporary toggle to hide the background (resets per chat)
  const [backgroundHidden, setBackgroundHidden] = useState(false);

  // Image gallery view state
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [galleryModalImage, setGalleryModalImage] = useState(null);

  // Persist character image visibility
  useEffect(() => {
    localStorage.setItem('chatShowCharacterImage', JSON.stringify(showCharacterImage));
  }, [showCharacterImage]);

  // Listen for storage changes (when setting is changed in SDSettingsPage)
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('chatHorizontalAsBackground');
      setHorizontalAsBackground(saved !== null ? JSON.parse(saved) : true);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // All received images from character (take last 10 for rotation display)
  const receivedImages = (allImageUrls || [])
    .slice(-10)
    .map(img => getImageUrl(img.url || img));

  // Reset states when switching characters
  useEffect(() => {
    // Reset auto-scroll state and flag
    setAutoScrollEnabled(false);
    // Randomize initial image index
    setCurrentImageIndex(receivedImages.length > 0 ? Math.floor(Math.random() * receivedImages.length) : 0);
    hasAutoEnabledRef.current = false;
    // Reset background hidden state
    setBackgroundHidden(false);
    // Reset gallery state
    setShowImageGallery(false);
    setGalleryModalImage(null);
  }, [characterId]);

  // Auto-scroll timer for cycling through received images
  useEffect(() => {
    // Clear any existing interval
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }

    // Only start interval if auto-scroll is enabled and there are images to scroll through
    if (autoScrollEnabled && receivedImages.length > 0) {
      console.log(`[useCharacterImage] Auto-scroll enabled with ${receivedImages.length} images`);

      // Cycle every 60 seconds with random selection
      autoScrollIntervalRef.current = setInterval(() => {
        setCurrentImageIndex(() => {
          return Math.floor(Math.random() * receivedImages.length);
        });
      }, 60000);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }
    };
  }, [autoScrollEnabled, receivedImages.length]);

  // Randomize image index when toggling auto-scroll or when images change
  useEffect(() => {
    if (!autoScrollEnabled && receivedImages.length > 0) {
      setCurrentImageIndex(Math.floor(Math.random() * receivedImages.length));
    }
  }, [autoScrollEnabled, receivedImages.length]);

  // Auto-enable auto-scroll when images are available (only once per character)
  useEffect(() => {
    if (receivedImages.length > 0 && !autoScrollEnabled && !hasAutoEnabledRef.current) {
      setAutoScrollEnabled(true);
      hasAutoEnabledRef.current = true;
      console.log(`[useCharacterImage] Auto-enabled image scroll (${receivedImages.length} images available)`);
    }
  }, [receivedImages.length, autoScrollEnabled]);

  // Detect image orientation when current image changes
  useEffect(() => {
    const currentImageUrl = autoScrollEnabled && receivedImages.length > 0
      ? receivedImages[currentImageIndex]
      : character?.imageUrl;

    if (!currentImageUrl) {
      setIsHorizontalImage(false);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const isHorizontal = img.width > img.height;
      setIsHorizontalImage(isHorizontal);
    };
    img.onerror = () => {
      setIsHorizontalImage(false);
    };
    img.src = currentImageUrl;
  }, [autoScrollEnabled, receivedImages, currentImageIndex, character?.imageUrl]);

  // Get current display image URL
  const currentDisplayImage = autoScrollEnabled && receivedImages.length > 0
    ? receivedImages[currentImageIndex]
    : character?.imageUrl;

  // Show horizontal image as background only if setting is enabled
  const showAsBackground = isHorizontalImage && horizontalAsBackground;

  return {
    // Panel visibility
    showCharacterImage,
    setShowCharacterImage,

    // Auto-scroll
    autoScrollEnabled,
    setAutoScrollEnabled,
    currentImageIndex,

    // Orientation
    isHorizontalImage,

    // Background
    horizontalAsBackground,
    backgroundHidden,
    setBackgroundHidden,
    showAsBackground,
    currentDisplayImage,

    // Received images
    receivedImages,

    // Gallery
    showImageGallery,
    setShowImageGallery,
    galleryModalImage,
    setGalleryModalImage,
  };
};
