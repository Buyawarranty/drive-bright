import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Fallback links used only if the lookup fails — the live documents always come
// from customer_documents so a new upload takes effect everywhere immediately.
export const FALLBACK_TERMS_PDF =
  'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/terms/terms-and-conditions-v3.4-2026-06-02.pdf';
export const FALLBACK_PLATINUM_PDF =
  'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/platinum-warranty-plan-v3.4-2026-06-02.pdf';

interface LatestPolicyDocs {
  termsUrl: string;
  platinumUrl: string;
  termsName: string | null;
  platinumName: string | null;
  loading: boolean;
}

/**
 * Single source of truth for the current Terms & Conditions and Platinum
 * Warranty Plan PDFs shown across the public site, checkout and portal.
 */
export const useLatestPolicyDocs = (): LatestPolicyDocs => {
  const [docs, setDocs] = useState<LatestPolicyDocs>({
    termsUrl: FALLBACK_TERMS_PDF,
    platinumUrl: FALLBACK_PLATINUM_PDF,
    termsName: null,
    platinumName: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from('customer_documents')
        .select('plan_type, file_url, document_name, created_at')
        .in('plan_type', ['terms-and-conditions', 'platinum'])
        .order('created_at', { ascending: false });

      if (cancelled) return;

      const terms = data?.find((d) => d.plan_type === 'terms-and-conditions');
      const platinum = data?.find((d) => d.plan_type === 'platinum');

      setDocs({
        termsUrl: terms?.file_url || FALLBACK_TERMS_PDF,
        platinumUrl: platinum?.file_url || FALLBACK_PLATINUM_PDF,
        termsName: terms?.document_name ?? null,
        platinumName: platinum?.document_name ?? null,
        loading: false,
      });
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return docs;
};
