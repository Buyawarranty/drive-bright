import React, { useEffect, useRef, useState } from 'react';

interface LazySectionProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
}

/**
 * Lazy-loads content when it enters the viewport using IntersectionObserver
 * Reduces initial JavaScript execution and improves TBT on mobile
 */
const LazySection: React.FC<LazySectionProps> = ({ 
  children, 
  fallback = <div className="min-h-[200px]" />,
  rootMargin = '200px'
}) => {
  const [isInView, setIsInView] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin }
    );

    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={sectionRef}>
      {isInView ? children : fallback}
    </div>
  );
};

export default LazySection;
