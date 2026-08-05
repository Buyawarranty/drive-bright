import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  BASE_PRICING_MATRIX,
  ADMIN_QUOTE_PRICE_MULTIPLIER,
  type PricingMatrixShape,
} from '@/lib/pricingMatrix';

export interface PricingVersion {
  id: string;
  label: string;
  status: 'draft' | 'live' | 'archived';
  admin_matrix: PricingMatrixShape;
  step3_discount_pct: number;
  claim_limit_factors?: { limit: number; factor: number }[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export const PERIODS = ['12months', '24months', '36months'] as const;
export const EXCESSES = [0, 50, 100, 150, 250, 500] as const;
export const CLAIM_LIMITS = [750, 1250, 2000] as const;

/**
 * The current live-in-code Quotes & Orders grid: base matrix × 1.10 (floored).
 * Used as the starting point for a new draft so nothing changes until edited.
 */
export function buildCodeAdminMatrix(): PricingMatrixShape {
  const out: PricingMatrixShape = {};
  for (const period of PERIODS) {
    out[period] = {};
    for (const excess of EXCESSES) {
      out[period][String(excess)] = {};
      for (const limit of CLAIM_LIMITS) {
        const base = (BASE_PRICING_MATRIX as any)[period][excess][limit] as number;
        out[period][String(excess)][String(limit)] = Math.floor(
          base * ADMIN_QUOTE_PRICE_MULTIPLIER
        );
      }
    }
  }
  return out;
}

export function usePricingVersions() {
  const [versions, setVersions] = useState<PricingVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pricing_matrix_versions')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setVersions(data as unknown as PricingVersion[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createVersion = useCallback(
    async (
      label: string,
      adminMatrix: PricingMatrixShape,
      step3DiscountPct: number,
      notes?: string,
      claimLimitFactors?: { limit: number; factor: number }[] | null
    ) => {
      const { data: authData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('pricing_matrix_versions')
        .insert({
          label,
          status: 'draft',
          admin_matrix: adminMatrix as any,
          step3_discount_pct: step3DiscountPct,
          claim_limit_factors: (claimLimitFactors ?? null) as any,
          notes: notes ?? null,
          created_by: authData?.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await load();
      return data as unknown as PricingVersion;
    },
    [load]
  );

  const saveVersion = useCallback(
    async (id: string, patch: Partial<Pick<PricingVersion, 'label' | 'admin_matrix' | 'step3_discount_pct' | 'notes' | 'claim_limit_factors'>>) => {
      const { error } = await supabase
        .from('pricing_matrix_versions')
        .update(patch as any)
        .eq('id', id);
      if (error) throw error;
      await load();
    },
    [load]
  );

  const publishVersion = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc('publish_pricing_version', { _version_id: id });
      if (error) throw error;
      await load();
    },
    [load]
  );

  const revertToCode = useCallback(async () => {
    const { error } = await supabase.rpc('revert_pricing_to_code_defaults');
    if (error) throw error;
    await load();
  }, [load]);

  const deleteVersion = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('pricing_matrix_versions').delete().eq('id', id);
      if (error) throw error;
      await load();
    },
    [load]
  );

  return {
    versions,
    loading,
    reload: load,
    createVersion,
    saveVersion,
    publishVersion,
    revertToCode,
    deleteVersion,
  };
}
