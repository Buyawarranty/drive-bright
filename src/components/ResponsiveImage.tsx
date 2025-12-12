import React, { memo } from 'react';

interface ResponsiveImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
}

/**
 * Responsive image component with explicit dimensions for CLS prevention
 * Uses native lazy loading for optimal performance
 */
export const ResponsiveImage: React.FC<ResponsiveImageProps> = memo(({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  sizes = '100vw'
}) => {
  const aspectRatio = `${width} / ${height}`;
  
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      // @ts-ignore - fetchpriority is valid but not in React types yet
      fetchpriority={priority ? 'high' : 'auto'}
      sizes={sizes}
      className={className}
      style={{ 
        aspectRatio,
        width: '100%',
        height: 'auto',
        maxWidth: `${width}px`
      }}
    />
  );
});

ResponsiveImage.displayName = 'ResponsiveImage';

export default ResponsiveImage;
