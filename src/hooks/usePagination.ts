import { useState, useMemo, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'leads_page_size';
const DEFAULT_PAGE_SIZE = 50;

/**
 * Get persisted page size from localStorage
 */
function getPersistedPageSize(): number {
  if (typeof window === 'undefined') return DEFAULT_PAGE_SIZE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if ([25, 50, 100, 200].includes(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    // localStorage not available
  }
  return DEFAULT_PAGE_SIZE;
}

/**
 * Persist page size to localStorage
 */
function persistPageSize(size: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, size.toString());
  } catch (e) {
    // localStorage not available
  }
}

interface UsePaginationOptions {
  initialPageSize?: number;
  initialPage?: number;
  persistKey?: string;
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
 * Persists page size preference to localStorage.
 */
export function usePagination<T>(
  data: T[],
  options: UsePaginationOptions = {}
): UsePaginationResult<T> {
  const { initialPage = 1 } = options;
  
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(() => getPersistedPageSize());

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
    persistPageSize(size); // Persist to localStorage
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
