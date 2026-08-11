import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  TRUSTPILOT_RATING_VALUE,
  TRUSTPILOT_REVIEW_COUNT,
} from '@/lib/seo/trustpilotRating';

/**
 * Keeps every AggregateRating in the page's JSON-LD in step with the live
 * Trustpilot profile.
 *
 * Pages render their schema with the fallback constants; once the live figures
 * arrive from the `trustpilot-rating` edge function this rewrites the
 * ratingValue / reviewCount inside each JSON-LD block so the markup Google
 * reads is always the genuine, current score.
 */
const LOCAL_CACHE_KEY = 'trustpilot-rating-v1';
const LOCAL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface Rating {
  ratingValue: string;
  reviewCount: string;
}

function patchJsonLd({ ratingValue, reviewCount }: Rating) {
  if (
    ratingValue === TRUSTPILOT_RATING_VALUE &&
    reviewCount === TRUSTPILOT_REVIEW_COUNT
  ) {
    return;
  }

  const scripts = document.querySelectorAll<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  );

  scripts.forEach((script) => {
    if (!script.textContent?.includes('AggregateRating')) return;
    try {
      const parsed = JSON.parse(script.textContent);
      let changed = false;

      const walk = (node: unknown) => {
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        if (!node || typeof node !== 'object') return;
        const obj = node as Record<string, unknown>;
        if (obj['@type'] === 'AggregateRating') {
          obj.ratingValue = ratingValue;
          obj.reviewCount = reviewCount;
          changed = true;
        }
        Object.values(obj).forEach(walk);
      };

      walk(parsed);
      if (changed) script.textContent = JSON.stringify(parsed);
    } catch {
      // Non-JSON or partially rendered block — leave it untouched.
    }
  });
}

export const TrustpilotRatingSync = () => {
  useEffect(() => {
    let cancelled = false;

    const cached = (() => {
      try {
        const raw = localStorage.getItem(LOCAL_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Rating & { fetchedAt: number };
        if (Date.now() - parsed.fetchedAt > LOCAL_CACHE_TTL_MS) return null;
        return parsed;
      } catch {
        return null;
      }
    })();

    if (cached) {
      patchJsonLd(cached);
      return;
    }

    const load = async () => {
      const { data, error } = await supabase.functions.invoke('trustpilot-rating');
      if (cancelled || error || !data?.ratingValue || !data?.reviewCount) return;

      const rating: Rating = {
        ratingValue: String(data.ratingValue),
        reviewCount: String(data.reviewCount),
      };

      try {
        localStorage.setItem(
          LOCAL_CACHE_KEY,
          JSON.stringify({ ...rating, fetchedAt: Date.now() }),
        );
      } catch {
        // Storage unavailable (private mode) — patching still works.
      }

      patchJsonLd(rating);
    };

    // Let the route's own JSON-LD mount first.
    const timer = window.setTimeout(load, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return null;
};
