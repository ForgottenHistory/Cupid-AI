import sharp from 'sharp';

/**
 * Generate a thumbnail from a base64 image data URL
 * @param {string} imageUrl - Base64 data URL (data:image/png;base64,...)
 * @returns {Promise<string|null>} - Thumbnail as base64 data URL or null if failed
 */
export async function generateThumbnail(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('data:')) {
    return null;
  }

  try {
    const base64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!base64Match) {
      return null;
    }

    const imageBuffer = Buffer.from(base64Match[1], 'base64');

    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(128, 170, { fit: 'cover' })
      .png({ quality: 80 })
      .toBuffer();

    return `data:image/png;base64,${thumbnailBuffer.toString('base64')}`;
  } catch (error) {
    console.warn('Failed to generate thumbnail:', error.message);
    return null;
  }
}
