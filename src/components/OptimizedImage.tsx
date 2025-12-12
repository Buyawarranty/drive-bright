import React, { useState, useEffect, useRef, memo } from 'react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  /** Enable native lazy loading only (faster, less JS) */
  nativeOnly?: boolean;
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
  nativeOnly = true, // Default to native-only for better performance
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(priority);
  const [isInView, setIsInView] = useState(priority || nativeOnly);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority || nativeOnly) return; // Skip observer for priority/native-only images

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
  }, [priority, nativeOnly]);

  // Prevent layout shift by providing explicit dimensions
  const imageStyle: React.CSSProperties = {
    ...style,
    ...(width && height && { 
      aspectRatio: `${width}/${height}`,
      width: '100%',
      height: 'auto'
    }),
  };

  // Common props for both priority and non-priority images
  const commonProps = {
    ref: imgRef,
    alt,
    width,
    height,
    className: `${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`,
    style: imageStyle,
    onLoad: () => setIsLoaded(true),
    ...props
  };

  // For priority images, render immediately with fetchpriority
  if (priority) {
    return (
      <img
        {...commonProps}
        src={src}
        loading="eager"
        decoding="async"
        // @ts-ignore - fetchpriority is valid but not in React types yet
        fetchpriority="high"
        className={className}
      />
    );
  }

  return (
    <img
      {...commonProps}
      src={isInView ? src : undefined}
      loading="lazy"
      decoding="async"
    />
  );
});

OptimizedImage.displayName = 'OptimizedImage';
