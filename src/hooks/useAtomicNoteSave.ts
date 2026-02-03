import { useRef, useCallback, useState } from 'react';

// Simple unique ID generator (no external dependency)
const generateWriteId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

interface NoteWriteState {
  isWriting: boolean;
  lastWriteId: string | null;
  lastSavedContent: string;
  pendingContent: string | null;
  error: string | null;
}

interface UseAtomicNoteSaveOptions {
  debounceMs?: number;
  onSave: (content: string) => Promise<void>;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * Hook for atomic, single-write note saves with proper debouncing and write-locking.
 * Guarantees:
 * - Only one write operation per note at any time
 * - Autosave only triggers after user stops typing
 * - No duplicate submissions
 * - Proper error handling with retry capability
 */
export function useAtomicNoteSave({
  debounceMs = 1000,
  onSave,
  onSuccess,
  onError
}: UseAtomicNoteSaveOptions) {
  const [state, setState] = useState<NoteWriteState>({
    isWriting: false,
    lastWriteId: null,
    lastSavedContent: '',
    pendingContent: null,
    error: null
  });

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const writeInProgressRef = useRef<boolean>(false);
  const currentWriteIdRef = useRef<string | null>(null);

  // Clear any pending debounce
  const clearDebounce = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  // Execute the actual save with write-lock protection
  const executeSave = useCallback(async (content: string, writeId: string): Promise<boolean> => {
    // Check if another write is in progress
    if (writeInProgressRef.current) {
      console.log(`[AtomicNote] Write blocked - another write in progress. WriteId: ${writeId}`);
      // Store as pending
      setState(prev => ({ ...prev, pendingContent: content }));
      return false;
    }

    // Check if content is the same as last saved (deduplication)
    if (content === state.lastSavedContent) {
      console.log(`[AtomicNote] Skipping save - content unchanged. WriteId: ${writeId}`);
      return true;
    }

    // Acquire write lock
    writeInProgressRef.current = true;
    currentWriteIdRef.current = writeId;
    setState(prev => ({ 
      ...prev, 
      isWriting: true, 
      error: null,
      pendingContent: null 
    }));

    console.log(`[AtomicNote] Starting write. WriteId: ${writeId}, Content length: ${content.length}`);

    try {
      await onSave(content);
      
      // Verify this is still the current write (not stale)
      if (currentWriteIdRef.current !== writeId) {
        console.log(`[AtomicNote] Write completed but was superseded. WriteId: ${writeId}`);
        return false;
      }

      console.log(`[AtomicNote] Write successful. WriteId: ${writeId}`);
      
      setState(prev => ({ 
        ...prev, 
        isWriting: false,
        lastWriteId: writeId,
        lastSavedContent: content,
        error: null
      }));

      onSuccess?.();
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save note';
      console.error(`[AtomicNote] Write failed. WriteId: ${writeId}`, error);
      
      setState(prev => ({ 
        ...prev, 
        isWriting: false,
        error: errorMessage
      }));

      onError?.(errorMessage);
      
      return false;
    } finally {
      // Release write lock
      writeInProgressRef.current = false;
      currentWriteIdRef.current = null;

      // Check if there's pending content that needs to be saved
      const pending = state.pendingContent;
      if (pending && pending !== content) {
        console.log(`[AtomicNote] Processing pending content after lock release`);
        // Schedule pending save with a small delay
        setTimeout(() => {
          executeSave(pending, generateWriteId());
        }, 100);
      }
    }
  }, [onSave, onSuccess, onError, state.lastSavedContent, state.pendingContent]);

  // Debounced save for autosave functionality
  const debouncedSave = useCallback((content: string) => {
    clearDebounce();

    // Don't schedule if content is empty or same as last saved
    if (!content.trim()) {
      return;
    }

    if (content.trim() === state.lastSavedContent) {
      console.log('[AtomicNote] Debounced save skipped - content unchanged');
      return;
    }

    debounceTimeoutRef.current = setTimeout(() => {
      const writeId = generateWriteId();
      console.log(`[AtomicNote] Debounce triggered. Scheduling write. WriteId: ${writeId}`);
      executeSave(content.trim(), writeId);
    }, debounceMs);
  }, [clearDebounce, debounceMs, executeSave, state.lastSavedContent]);

  // Immediate save (for manual save button)
  const immediateSave = useCallback(async (content: string): Promise<boolean> => {
    clearDebounce();
    
    if (!content.trim()) {
      return false;
    }

    const writeId = generateWriteId();
    console.log(`[AtomicNote] Immediate save requested. WriteId: ${writeId}`);
    return executeSave(content.trim(), writeId);
  }, [clearDebounce, executeSave]);

  // Reset state (for when switching leads)
  const reset = useCallback(() => {
    clearDebounce();
    writeInProgressRef.current = false;
    currentWriteIdRef.current = null;
    setState({
      isWriting: false,
      lastWriteId: null,
      lastSavedContent: '',
      pendingContent: null,
      error: null
    });
  }, [clearDebounce]);

  // Retry last failed save
  const retry = useCallback(async (content: string): Promise<boolean> => {
    setState(prev => ({ ...prev, error: null }));
    return immediateSave(content);
  }, [immediateSave]);

  return {
    isWriting: state.isWriting,
    error: state.error,
    lastSavedContent: state.lastSavedContent,
    hasPendingWrite: state.pendingContent !== null,
    debouncedSave,
    immediateSave,
    reset,
    retry,
    clearDebounce
  };
}
