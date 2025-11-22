import React, { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface PerformanceOptimizedSuspenseProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  height?: string;
}

const PerformanceOptimizedSuspense: React.FC<PerformanceOptimizedSuspenseProps> = ({ 
  children, 
  fallback,
  height = "40vh" 
}) => {
  // Lightweight fallback to reduce bundle size and improve LCP
  const defaultFallback = (
    <div className="flex items-center justify-center p-4" style={{ minHeight: height }}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <Suspense fallback={fallback || defaultFallback}>
      {children}
    </Suspense>
  );
};

export default PerformanceOptimizedSuspense;