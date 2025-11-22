// Optimized localStorage utilities with batching and error handling

// Check if storage is available (handles iOS Safari private mode)
export const isStorageAvailable = (type: 'localStorage' | 'sessionStorage' = 'localStorage'): boolean => {
  try {
    const storage = type === 'localStorage' ? window.localStorage : window.sessionStorage;
    const testKey = '__storage_test__';
    storage.setItem(testKey, 'test');
    storage.removeItem(testKey);
    return true;
  } catch (error) {
    console.warn(`${type} is not available:`, error);
    return false;
  }
};

export const batchLocalStorageWrite = (updates: Record<string, string>) => {
  if (!isStorageAvailable('localStorage')) {
    console.warn('localStorage not available - skipping batch write');
    return;
  }
  try {
    Object.entries(updates).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
  } catch (error) {
    console.error('Error writing to localStorage:', error);
  }
};

export const saveWithTimestamp = (key: string, value: string) => {
  try {
    const data = {
      value,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving ${key} with timestamp:`, error);
  }
};

export const getWithTimestamp = (key: string, expiryDays: number = 30): string | null => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const data = JSON.parse(item);
    const now = Date.now();
    const expiryTime = expiryDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds

    // Check if data has expired
    if (now - data.timestamp > expiryTime) {
      localStorage.removeItem(key);
      return null;
    }

    return data.value;
  } catch (error) {
    console.error(`Error reading ${key} with timestamp:`, error);
    return null;
  }
};

export const safeLocalStorageRead = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error(`Error reading from localStorage key ${key}:`, error);
    return null;
  }
};

export const safeLocalStorageRemove = (keys: string[]) => {
  try {
    keys.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('Error removing from localStorage:', error);
  }
};

export const parseLocalStorageJSON = <T>(key: string): T | null => {
  try {
    const value = safeLocalStorageRead(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`Error parsing JSON from localStorage key ${key}:`, error);
    return null;
  }
};