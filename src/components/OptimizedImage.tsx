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
  const [isLoaded, setIsLoaded] = useState(priority); // Priority images start as loaded
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority) return; // Skip observer for priority images

    // Use native lazy loading support check
    if ('loading' in HTMLImageElement.prototype) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '200px', // Start loading earlier for smoother experience
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [priority]);

  // Prevent layout shift by providing explicit dimensions
  const imageStyle: React.CSSProperties = {
    ...style,
    ...(width && height && { aspectRatio: `${width}/${height}` }),
  };

  // For priority images, render immediately with fetchpriority
  if (priority) {
    return (
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="eager"
        decoding="async"
        // @ts-ignore - fetchpriority is valid but not in React types yet
        fetchpriority="high"
        className={className}
        style={imageStyle}
        {...props}
      />
    );
  }

  return (
    <img
      ref={imgRef}
      src={isInView ? src : undefined}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
      style={imageStyle}
      onLoad={() => setIsLoaded(true)}
      {...props}
    />
  );
});
