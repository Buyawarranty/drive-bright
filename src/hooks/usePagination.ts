import { useState, useMemo, useCallback } from 'react';

interface UsePaginationOptions {
  initialPageSize?: number;
  initialPage?: number;
}

interface UsePaginationResult<T> {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  paginatedData: T[];
  startIndex: number;
  endIndex: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setPageSize: (size: number) => void;
  canGoNext: boolean;
  canGoPrev: boolean;
}

/**
 * A hook for client-side pagination of data arrays.
 * Provides efficient slicing and navigation utilities.
 */
export function usePagination<T>(
  data: T[],
  options: UsePaginationOptions = {}
): UsePaginationResult<T> {
  const { initialPageSize = 50, initialPage = 1 } = options;
  
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Reset to page 1 when data changes significantly
  const safeCurrentPage = Math.min(currentPage, Math.max(1, totalPages));
  
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedData = useMemo(() => {
    return data.slice(startIndex, endIndex);
  }, [data, startIndex, endIndex]);

  const goToPage = useCallback((page: number) => {
    const safePage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(safePage);
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when page size changes
  }, []);

  return {
    currentPage: safeCurrentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedData,
    startIndex,
    endIndex,
    goToPage,
    nextPage,
    prevPage,
    setPageSize: handleSetPageSize,
    canGoNext: safeCurrentPage < totalPages,
    canGoPrev: safeCurrentPage > 1,
  };
}
