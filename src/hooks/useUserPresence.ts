import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseUserPresenceOptions {
  currentTab?: string;
  heartbeatInterval?: number; // in milliseconds
}

export const useUserPresence = (options: UseUserPresenceOptions = {}) => {
  const { currentTab, heartbeatInterval = 30000 } = options; // Default 30 seconds
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);

  const updatePresence = useCallback(async (status: 'online' | 'away' | 'busy' | 'offline' = 'online') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.rpc('update_user_presence', {
        p_status: status,
        p_current_tab: currentTab || null
      });
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }, [currentTab]);

  const setOffline = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.rpc('set_user_offline');
    } catch (error) {
      console.error('Error setting offline:', error);
    }
  }, []);

  // Handle visibility change (tab focus/blur)
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      isActiveRef.current = false;
      updatePresence('away');
    } else {
      isActiveRef.current = true;
      updatePresence('online');
    }
  }, [updatePresence]);

  // Handle user activity
  const handleActivity = useCallback(() => {
    if (!isActiveRef.current) {
      isActiveRef.current = true;
      updatePresence('online');
    }
  }, [updatePresence]);

  // Handle before unload (closing tab/window)
  const handleBeforeUnload = useCallback(() => {
    // Use sendBeacon for reliable offline status update
    const user = supabase.auth.getSession();
    if (user) {
      navigator.sendBeacon && setOffline();
    }
  }, [setOffline]);

  useEffect(() => {
    // Initial presence update
    updatePresence('online');

    // Set up heartbeat
    heartbeatRef.current = setInterval(() => {
      if (isActiveRef.current) {
        updatePresence('online');
      }
    }, heartbeatInterval);

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Cleanup
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Set offline when unmounting
      setOffline();
    };
  }, [updatePresence, setOffline, handleVisibilityChange, handleActivity, handleBeforeUnload, heartbeatInterval]);

  return { updatePresence, setOffline };
};
