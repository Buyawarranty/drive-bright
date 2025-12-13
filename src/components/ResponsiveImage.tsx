import React from 'react';

interface ImageSource {
  srcSet: string;
  type: string;
  media?: string;
}

interface ResponsiveImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  sizes?: string;
  sources?: ImageSource[];
  style?: React.CSSProperties;
}

/**
 * Responsive image component with modern format support
 * Uses <picture> element for AVIF/WebP fallbacks
 * Supports lazy loading for non-priority images
 */
export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  alt,
  width,
  height,
  priority = false,
  className = '',
  sizes,
  sources = [],
  style,
}) => {
  const imageStyle: React.CSSProperties = {
    ...style,
    ...(width && height && { aspectRatio: `${width} / ${height}` }),
  };

  // If we have sources, use picture element
  if (sources.length > 0) {
    return (
      <picture>
        {sources.map((source, index) => (
          <source
            key={index}
            srcSet={source.srcSet}
            type={source.type}
            media={source.media}
          />
        ))}
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
        />
      </picture>
    );
  }

  // Simple img element for single source
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
    />
  );
};

export default ResponsiveImage;
