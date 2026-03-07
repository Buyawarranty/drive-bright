import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const getOrCreateVisitorId = (): string => {
  const key = 'baw_visitor_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
};

const getSessionId = (): string => {
  const key = 'baw_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
};

export const PageViewLogger = () => {
  const location = useLocation();
  const lastTrackedPath = useRef<string>('');

  useEffect(() => {
    const fullPath = location.pathname + location.search;
    
    // Don't double-track same path
    if (fullPath === lastTrackedPath.current) return;
    lastTrackedPath.current = fullPath;

    // Don't track admin routes
    if (location.pathname.startsWith('/admin')) return;

    const params = new URLSearchParams(location.search);

    const pageView = {
      page_path: location.pathname,
      page_title: document.title || null,
      referrer: document.referrer || null,
      utm_source: params.get('utm_source') || null,
      utm_medium: params.get('utm_medium') || null,
      utm_campaign: params.get('utm_campaign') || null,
      utm_term: params.get('utm_term') || null,
      utm_content: params.get('utm_content') || null,
      gclid: params.get('gclid') || null,
      fbclid: params.get('fbclid') || null,
      user_agent: navigator.userAgent || null,
      screen_width: window.innerWidth,
      screen_height: window.innerHeight,
      session_id: getSessionId(),
      visitor_id: getOrCreateVisitorId(),
      is_google_ads: !!(params.get('gclid') || params.get('utm_source')?.toLowerCase() === 'google'),
      is_facebook_ads: !!(params.get('fbclid') || params.get('utm_source')?.toLowerCase() === 'facebook' || params.get('utm_source')?.toLowerCase() === 'fb' || params.get('utm_source')?.toLowerCase() === 'ig'),
    };

    supabase.from('page_views').insert(pageView).then(({ error }) => {
      if (error) console.error('Page view tracking error:', error);
    });
  }, [location.pathname, location.search]);

  return null;
};
