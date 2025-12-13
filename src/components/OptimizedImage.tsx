import React, { useState, useEffect, useRef } from 'react';

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
 * Automatically adds proper dimensions to prevent CLS
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  priority = false,
  className = '',
  style,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority) return; // Skip observer for priority images

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
        rootMargin: '100px', // Start loading before image enters viewport
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

  return (
    <img
      ref={imgRef}
      src={isInView ? src : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      className={`${className} ${
        priority 
          ? '' 
          : `${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`
      }`}
      style={imageStyle}
      onLoad={() => setIsLoaded(true)}
      {...props}
    />
  );
};
