import React from 'react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  sizes?: string;
}

/**
 * Optimized image component with proper loading strategies
 * - Priority images: eager loading, high fetch priority, sync decoding
 * - Non-priority images: lazy loading, auto fetch priority, async decoding
 * - Prevents CLS with explicit dimensions
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  priority = false,
  className = '',
  sizes,
  style,
  ...props
}) => {
  // Prevent layout shift by providing explicit dimensions
  const imageStyle: React.CSSProperties = {
    ...style,
    ...(width && height && { aspectRatio: `${width} / ${height}` }),
  };

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
      className={className}
      style={imageStyle}
      sizes={sizes}
      {...props}
    />
  );
};
