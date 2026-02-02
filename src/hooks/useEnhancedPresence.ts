import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PresenceStatus = 'active' | 'idle' | 'offline';

interface UseEnhancedPresenceOptions {
  activeThresholdMs?: number;
  idleThresholdMs?: number;
  heartbeatIntervalMs?: number;
}

interface PresenceState {
  status: PresenceStatus;
  lastInteractionAt: Date;
  isVisible: boolean;
  interactionCount: number;
}

// Non-blocking RPC helper - never throws, never blocks
const safeRpc = (name: 'log_agent_interaction' | 'update_user_presence' | 'set_user_offline', params?: Record<string, unknown>) => {
  // Fire and forget - do NOT await or block
  (async () => {
    try {
      await (supabase.rpc as any)(name, params);
    } catch (e) {
      // Silent fail - non-critical
    }
  })();
};

export const useEnhancedPresence = (options: UseEnhancedPresenceOptions = {}) => {
  const {
    activeThresholdMs = 90000,
    idleThresholdMs = 300000,
    heartbeatIntervalMs = 15000
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

  const logInteraction = useCallback(() => {
    safeRpc('log_agent_interaction', { p_event_type: 'activity' });
  }, []);

  const updatePresenceStatus = useCallback(() => {
    const now = new Date();
    const timeSinceLastInteraction = now.getTime() - lastInteractionRef.current.getTime();
    const isVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;

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

    const statusMap: Record<PresenceStatus, string> = {
      active: 'online',
      idle: 'away',
      offline: 'offline'
    };

    safeRpc('update_user_presence', { p_status: statusMap[newStatus], p_current_tab: 'leads' });
  }, [activeThresholdMs, idleThresholdMs]);

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

    if (interactionCountRef.current % 10 === 0) {
      logInteraction();
    }
  }, [logInteraction]);

  const handleVisibilityChange = useCallback(() => {
    if (typeof document === 'undefined') return;
    
    if (document.visibilityState === 'visible') {
      handleInteraction();
    } else {
      setPresenceState(prev => ({
        ...prev,
        status: 'offline',
        isVisible: false
      }));
      safeRpc('update_user_presence', { p_status: 'offline', p_current_tab: 'leads' });
    }
  }, [handleInteraction]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    setTimeout(() => handleInteraction(), 100);

    const interactionEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart', 'touchmove', 'paste', 'focus'];

    let throttleTimer: NodeJS.Timeout | null = null;
    const throttledHandler = () => {
      if (!throttleTimer) {
        handleInteraction();
        throttleTimer = setTimeout(() => { throttleTimer = null; }, 1000);
      }
    };

    interactionEvents.forEach(event => {
      window.addEventListener(event, throttledHandler, { passive: true });
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);

    heartbeatRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        safeRpc('update_user_presence', { p_status: presenceState.status === 'active' ? 'online' : 'away', p_current_tab: 'leads' });
      }
    }, heartbeatIntervalMs);

    statusCheckRef.current = setInterval(updatePresenceStatus, 5000);

    return () => {
      interactionEvents.forEach(event => {
        window.removeEventListener(event, throttledHandler);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (statusCheckRef.current) clearInterval(statusCheckRef.current);
      if (throttleTimer) clearTimeout(throttleTimer);

      safeRpc('set_user_offline');
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
