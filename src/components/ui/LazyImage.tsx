import React, { memo } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}

/**
 * Simple lazy image with explicit dimensions to prevent layout shift
 * Uses native lazy loading for best performance
 */
export const LazyImage: React.FC<LazyImageProps> = memo(({
  src,
  alt,
  width,
  height,
  className = '',
  style,
  ...props
}) => {
  const imageStyle: React.CSSProperties = {
    ...style,
    aspectRatio: `${width}/${height}`,
  };

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className={className}
      style={imageStyle}
      {...props}
    />
  );
});

LazyImage.displayName = 'LazyImage';
