import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PresenceStatus = 'active' | 'idle' | 'offline';

interface UseEnhancedPresenceOptions {
  activeThresholdMs?: number;  // Time without interaction before going idle (90s default)
  idleThresholdMs?: number;    // Time without interaction before going offline (300s default)
  heartbeatIntervalMs?: number; // Heartbeat interval (15s default)
}

interface PresenceState {
  status: PresenceStatus;
  lastInteractionAt: Date;
  isVisible: boolean;
  interactionCount: number;
}

export const useEnhancedPresence = (options: UseEnhancedPresenceOptions = {}) => {
  const {
    activeThresholdMs = 90000,   // 90 seconds
    idleThresholdMs = 300000,    // 300 seconds (5 minutes)
    heartbeatIntervalMs = 15000  // 15 seconds
  } = options;

  const [presenceState, setPresenceState] = useState<PresenceState>({
    status: 'active',
    lastInteractionAt: new Date(),
    isVisible: true,
    interactionCount: 0
  });

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const statusCheckRef = useRef<NodeJS.Timeout | null>(null);
  const lastInteractionRef = useRef<Date>(new Date());
  const interactionCountRef = useRef<number>(0);

  // Log interaction to database
  const logInteraction = useCallback(async () => {
    try {
      await supabase.rpc('log_agent_interaction', { p_event_type: 'activity' });
    } catch (error) {
      console.error('Error logging interaction:', error);
    }
  }, []);

  // Update presence status based on thresholds
  const updatePresenceStatus = useCallback(() => {
    const now = new Date();
    const timeSinceLastInteraction = now.getTime() - lastInteractionRef.current.getTime();
    const isVisible = document.visibilityState === 'visible';

    let newStatus: PresenceStatus;

    if (!isVisible || timeSinceLastInteraction >= idleThresholdMs) {
      newStatus = 'offline';
    } else if (timeSinceLastInteraction >= activeThresholdMs) {
      newStatus = 'idle';
    } else {
      newStatus = 'active';
    }

    setPresenceState(prev => ({
      ...prev,
      status: newStatus,
      isVisible,
      lastInteractionAt: lastInteractionRef.current
    }));

    // Update database presence
    const statusMap: Record<PresenceStatus, string> = {
      active: 'online',
      idle: 'away',
      offline: 'offline'
    };

    (async () => {
      try {
        await supabase.rpc('update_user_presence', {
          p_status: statusMap[newStatus],
          p_current_tab: 'leads'
        });
      } catch (e) {
        console.error(e);
      }
    })();

  }, [activeThresholdMs, idleThresholdMs]);

  // Handle real user interaction
  const handleInteraction = useCallback(() => {
    lastInteractionRef.current = new Date();
    interactionCountRef.current += 1;

    setPresenceState(prev => ({
      ...prev,
      status: 'active',
      lastInteractionAt: lastInteractionRef.current,
      interactionCount: interactionCountRef.current,
      isVisible: true
    }));

    // Debounce database logging (only log every 10 seconds)
    const shouldLog = interactionCountRef.current % 10 === 0;
    if (shouldLog) {
      logInteraction();
    }
  }, [logInteraction]);

  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      // User came back to tab
      handleInteraction();
    } else {
      // Tab hidden - mark as offline
      setPresenceState(prev => ({
        ...prev,
        status: 'offline',
        isVisible: false
      }));
      (async () => {
        try {
          await supabase.rpc('update_user_presence', {
            p_status: 'offline',
            p_current_tab: 'leads'
          });
        } catch (e) {
          console.error(e);
        }
      })();
    }
  }, [handleInteraction]);

  // Set up event listeners
  useEffect(() => {
    // Initial presence update
    handleInteraction();

    // Events that count as real interactions
    const interactionEvents = [
      'click',
      'keydown',
      'mousemove',
      'scroll',
      'touchstart',
      'touchmove',
      'paste',
      'focus'
    ];

    // Throttled handler
    let throttleTimer: NodeJS.Timeout | null = null;
    const throttledHandler = () => {
      if (!throttleTimer) {
        handleInteraction();
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
        }, 1000); // Throttle to 1 interaction per second
      }
    };

    // Add interaction listeners
    interactionEvents.forEach(event => {
      window.addEventListener(event, throttledHandler, { passive: true });
    });

    // Visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Heartbeat for connection health
    heartbeatRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        (async () => {
          try {
            await supabase.rpc('update_user_presence', {
              p_status: presenceState.status === 'active' ? 'online' : 'away',
              p_current_tab: 'leads'
            });
          } catch (e) {
            console.error(e);
          }
        })();
      }
    }, heartbeatIntervalMs);

    // Status check interval
    statusCheckRef.current = setInterval(updatePresenceStatus, 5000);

    // Cleanup
    return () => {
      interactionEvents.forEach(event => {
        window.removeEventListener(event, throttledHandler);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (statusCheckRef.current) clearInterval(statusCheckRef.current);
      if (throttleTimer) clearTimeout(throttleTimer);

      // Set offline on unmount
      (async () => {
        try {
          await supabase.rpc('set_user_offline');
        } catch (e) {
          console.error(e);
        }
      })();
    };
  }, [handleInteraction, handleVisibilityChange, updatePresenceStatus, heartbeatIntervalMs, presenceState.status]);

  return {
    status: presenceState.status,
    isActive: presenceState.status === 'active',
    isIdle: presenceState.status === 'idle',
    isOffline: presenceState.status === 'offline',
    lastInteractionAt: presenceState.lastInteractionAt,
    isVisible: presenceState.isVisible,
    interactionCount: presenceState.interactionCount,
    triggerInteraction: handleInteraction
  };
};
