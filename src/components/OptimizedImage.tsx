import React, { useState, useEffect, useRef, memo } from 'react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
}

/**
 * Optimized image component with lazy loading and intersection observer
 * Improves Core Web Vitals by deferring off-screen images
 * Priority images load immediately for LCP optimization
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = memo(({
  src,
  alt,
  width,
  height,
  priority = false,
  className = '',
  style,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(priority);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority) return;

    // Use native lazy loading - no need for IntersectionObserver
    setIsInView(true);
  }, [priority]);

  // Prevent layout shift by providing explicit dimensions
  const imageStyle: React.CSSProperties = {
    ...style,
    // Always set aspect ratio when dimensions provided to prevent CLS
    ...(width && height && { 
      aspectRatio: `${width}/${height}`,
      width: '100%',
      height: 'auto'
    }),
  };

  // Common img attributes for performance
  const commonProps = {
    ref: imgRef,
    alt,
    width,
    height,
    decoding: 'async' as const,
    ...props
  };

  // For priority images, render immediately with fetchpriority
  if (priority) {
    return (
      <img
        {...commonProps}
        src={src}
        loading="eager"
        // @ts-ignore - fetchpriority is valid but not in React types yet
        fetchpriority="high"
        className={className}
        style={imageStyle}
      />
    );
  }

  return (
    <img
      {...commonProps}
      src={isInView ? src : undefined}
      data-src={src}
      loading="lazy"
      className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
      style={imageStyle}
      onLoad={() => setIsLoaded(true)}
    />
  );
});

OptimizedImage.displayName = 'OptimizedImage';
