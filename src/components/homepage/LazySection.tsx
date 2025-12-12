import React, { useEffect, useRef, useState, memo } from 'react';

interface LazySectionProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  /** Minimum height placeholder to prevent layout shift */
  minHeight?: string;
}

/**
 * Lazy-loads content when it enters the viewport using IntersectionObserver
 * Reduces initial JavaScript execution and improves TBT on mobile
 */
const LazySection: React.FC<LazySectionProps> = memo(({ 
  children, 
  fallback,
  rootMargin = '300px', // Increased for earlier loading
  minHeight = '200px'
}) => {
  const [isInView, setIsInView] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;

    // Use native IntersectionObserver for best performance
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { 
        rootMargin,
        threshold: 0 // Trigger as soon as any part is visible
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  // Render placeholder until in view
  if (!isInView) {
    return (
      <div 
        ref={sectionRef} 
        style={{ minHeight }}
        aria-hidden="true"
      >
        {fallback}
      </div>
    );
  }

  return <div ref={sectionRef}>{children}</div>;
});

LazySection.displayName = 'LazySection';

export default LazySection;
