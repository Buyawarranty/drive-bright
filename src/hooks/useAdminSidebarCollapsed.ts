import { useEffect, useState } from 'react';

const KEY = 'adminSidebarCollapsed';
const EVENT = 'admin-sidebar-collapsed-change';

const read = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Shared collapsed state for the left AdminSidebar so the main content area
 * can adjust its left margin in sync when the user toggles it.
 */
export const useAdminSidebarCollapsed = () => {
  const [collapsed, setCollapsedState] = useState<boolean>(() => read());

  useEffect(() => {
    const onChange = () => setCollapsedState(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const setCollapsed = (next: boolean) => {
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
    setCollapsedState(next);
    window.dispatchEvent(new Event(EVENT));
  };

  return { collapsed, setCollapsed, toggle: () => setCollapsed(!collapsed) };
};
