/**
 * Image optimization utilities
 * Provides responsive srcset and next-gen format support
 */

interface ImageOptions {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
  sizes?: string;
}

/**
 * Generate responsive image attributes with proper srcset
 */
export const getResponsiveImageProps = (options: ImageOptions) => {
  const { src, alt, width, height, loading = 'lazy', priority = false, sizes } = options;
  
  // For now, return optimized props
  // In production, you'd want to generate actual srcset with different sizes
  return {
    src,
    alt,
    width,
    height,
    loading: priority ? 'eager' : loading,
    decoding: 'async' as const,
    sizes: sizes || (width ? `${width}px` : '100vw'),
    // Add explicit dimensions to prevent layout shift
    style: width && height ? { aspectRatio: `${width}/${height}` } : undefined,
  };
};

/**
 * Preload critical images for LCP optimization
 */
export const preloadImage = (src: string, type: 'image/webp' | 'image/jpeg' | 'image/png' = 'image/webp') => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  link.type = type;
  document.head.appendChild(link);
};

/**
 * Check if WebP is supported
 */
export const supportsWebP = (() => {
  let support: boolean | undefined;
  
  return () => {
    if (support !== undefined) return support;
    
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      support = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } else {
      support = false;
    }
    
    return support;
  };
})();
