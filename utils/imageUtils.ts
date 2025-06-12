/**
 * Utility functions for handling images
 */

/**
 * Optimizes a Cloudinary URL for mobile display by adding transformation parameters
 * 
 * @param url Original Cloudinary URL
 * @param width Desired width (default: 300)
 * @param quality Image quality (default: 80)
 * @returns Optimized Cloudinary URL
 */
export const optimizeCloudinaryUrl = (url: string, width: number = 300, quality: number = 80): string => {
  if (!url || !url.includes('cloudinary.com')) {
    return url;
  }

  try {
    // Parse the URL to extract relevant parts
    // Format: https://res.cloudinary.com/[cloud_name]/image/upload/[version]/[folder]/[filename]
    const urlParts = url.split('/upload/');
    if (urlParts.length !== 2) return url;

    // Create transformation string
    const transformation = `w_${width},q_${quality},f_auto,c_limit`;
    
    // Return the new URL with transformations
    return `${urlParts[0]}/upload/${transformation}/${urlParts[1]}`;
  } catch (error) {
    console.log('Error optimizing image URL:', error);
    return url;
  }
};

/**
 * Get a placeholder URL for when images fail to load
 */
export const getPlaceholderImage = (): string => {
  return 'https://res.cloudinary.com/dn1fp5v93/image/upload/w_300,q_80,f_auto/v1/placeholder-image';
}; 