import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  BASE_PRICING_MATRIX,
  ADMIN_QUOTE_PRICE_MULTIPLIER,
  normalizeClaimColumnKeys,
  type PricingMatrixShape,
} from '@/lib/pricingMatrix';
import type { VehicleFactorModel } from '@/lib/pricing/vehicleFactorModel';
import { runPreflightCheck } from '@/lib/pricing/preflightCheck';
import {
  computeConfigChecksum,
  CODE_PRICE_FLOORS,
  CODE_ROUNDING_RULE,
  NEUTRAL_REFERENCE_FACTORS,
  type PricingVersionConfig,
  type PriceCaps,
  type PriceFloors,
  type ReferenceFactors,
  type ReferenceVehicle,
  type RoundingRule,
} from '@/lib/pricing/pricingVersionConfig';

export interface PricingVersion {
  id: string;
  label: string;
  status: 'draft' | 'live' | 'archived';
  admin_matrix: PricingMatrixShape;
  step3_discount_pct: number;
  claim_limit_factors?: { limit: number; factor: number }[] | null;
  labour_rate_factors?: { rate: number; factor: number; label?: string | null }[] | null;
  /** Age / mileage / powertrain / vehicle-type risk figures that price each vehicle. */
  vehicle_factor_model?: VehicleFactorModel | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  /** Self-contained config so any historical quote is reproducible. */
  reference_vehicle?: ReferenceVehicle | null;
  reference_factors?: ReferenceFactors | null;
  price_floors?: PriceFloors | null;
  price_caps?: PriceCaps | null;
  rounding_rule?: RoundingRule | null;
  effective_date?: string | null;
  model_version?: number | null;
  config_checksum?: string | null;
  published_by?: string | null;
}

export const PERIODS = ['12months', '24months', '36months'] as const;
export const EXCESSES = [0, 50, 100, 150, 250, 500] as const;
// Claim-limit columns are the real cover levels. Retired names (750/1250/2000)
// are normalised on read by normalizeClaimColumnKeys.
export const CLAIM_LIMITS = [1000, 2000, 3000] as const;

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
  const versionsRef = useRef<PricingVersion[]>([]);
  versionsRef.current = versions;

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pricing_matrix_versions')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      // Older rows store retired column names (750/1250/2000); map them to the
      // cover levels they meant so every panel reads one set of column keys.
      const rows = (data as unknown as PricingVersion[]).map(v => ({
        ...v,
        admin_matrix: (normalizeClaimColumnKeys(v.admin_matrix) ?? v.admin_matrix) as PricingMatrixShape,
      }));
      setVersions(rows);
    }
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
      claimLimitFactors?: { limit: number; factor: number }[] | null,
      labourRateFactors?: { rate: number; factor: number; label?: string | null }[] | null,
      vehicleFactorModel?: VehicleFactorModel | null,
      config?: PricingVersionConfig | null
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
          labour_rate_factors: (labourRateFactors ?? null) as any,
          vehicle_factor_model: (vehicleFactorModel ?? null) as any,
          notes: notes ?? null,
          created_by: authData?.user?.id ?? null,
          reference_vehicle: (config?.reference_vehicle ?? null) as any,
          reference_factors: (config?.reference_factors ?? NEUTRAL_REFERENCE_FACTORS) as any,
          price_floors: (config?.price_floors ?? CODE_PRICE_FLOORS) as any,
          price_caps: (config?.price_caps ?? null) as any,
          rounding_rule: config?.rounding_rule ?? CODE_ROUNDING_RULE,
          effective_date: config?.effective_date ?? null,
          config_checksum: computeConfigChecksum({
            admin_matrix: adminMatrix,
            step3_discount_pct: step3DiscountPct,
            claim_limit_factors: claimLimitFactors ?? null,
            labour_rate_factors: labourRateFactors ?? null,
            vehicle_factor_model: vehicleFactorModel ?? null,
            reference_vehicle: config?.reference_vehicle ?? null,
            reference_factors: config?.reference_factors ?? NEUTRAL_REFERENCE_FACTORS,
            price_floors: config?.price_floors ?? CODE_PRICE_FLOORS,
            price_caps: config?.price_caps ?? null,
            rounding_rule: config?.rounding_rule ?? CODE_ROUNDING_RULE,
          }),
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
    async (id: string, patch: Partial<Pick<PricingVersion, 'label' | 'admin_matrix' | 'step3_discount_pct' | 'notes' | 'claim_limit_factors' | 'labour_rate_factors' | 'vehicle_factor_model' | 'reference_vehicle' | 'reference_factors' | 'price_floors' | 'price_caps' | 'rounding_rule' | 'effective_date'>>) => {
      // Keep the checksum in step with whatever was just edited.
      const existing = versionsRef.current.find(v => v.id === id);
      const merged = { ...(existing ?? {}), ...patch } as PricingVersion;
      const { error } = await supabase
        .from('pricing_matrix_versions')
        .update({
          ...(patch as any),
          config_checksum: computeConfigChecksum({
            admin_matrix: merged.admin_matrix,
            step3_discount_pct: merged.step3_discount_pct,
            claim_limit_factors: merged.claim_limit_factors ?? null,
            labour_rate_factors: merged.labour_rate_factors ?? null,
            vehicle_factor_model: merged.vehicle_factor_model ?? null,
            reference_vehicle: merged.reference_vehicle ?? null,
            reference_factors: merged.reference_factors ?? NEUTRAL_REFERENCE_FACTORS,
            price_floors: merged.price_floors ?? CODE_PRICE_FLOORS,
            price_caps: merged.price_caps ?? null,
            rounding_rule: merged.rounding_rule ?? CODE_ROUNDING_RULE,
          }),
        })
        .eq('id', id);
      if (error) throw error;
      await load();
    },
    [load]
  );

  /**
   * Publishes a version — but only if it is complete.
   *
   * Every "Push live" path in the Price Updates section funnels through here, so
   * a version missing a grid cell, a labour rate, a claim-limit column or the
   * vehicle risk figures can never reach customers and silently fall back to
   * older numbers. Blocking gaps throw with a plain-English list; the caller
   * already surfaces the message in a toast. Pass `{ force: true }` only where a
   * manager has explicitly acknowledged non-blocking warnings.
   */
  const publishVersion = useCallback(
    async (id: string, opts?: { force?: boolean }) => {
      if (!opts?.force) {
        // Read the row we are about to publish (fresh, so a just-saved edit counts).
        const { data: row } = await supabase
          .from('pricing_matrix_versions')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (row) {
          const vfm = (row as any).vehicle_factor_model ?? null;
          // Excluded vehicle matrix is enforced on every publish, not just from
          // the push bar — a named vehicle with a price must not be on the list.
          const pricedVehicles = [
            ...(Array.isArray(vfm?.modelFloors) ? vfm.modelFloors : []),
            ...(Array.isArray(vfm?.modelRisks) ? vfm.modelRisks : []),
          ]
            .filter((r: any) => r?.covered !== false)
            .map((r: any) => {
              const text = String(r?.vehicle ?? r?.label ?? r?.key ?? '').trim();
              return { make: text, model: text, label: text };
            })
            .filter(v => v.label.length > 0);
          const report = runPreflightCheck({
            adminMatrix: (row as any).admin_matrix,
            labourRateFactors: (row as any).labour_rate_factors ?? null,
            vehicleFactorModel: vfm,
            webDiscountPct: (row as any).step3_discount_pct ?? null,
            pricedVehicles,
          });
          if (report.blocked) {
            const gaps = report.items
              .filter(i => i.severity === 'block')
              .map(i => `• ${i.label}: ${i.detail}${i.gaps?.length ? ` (${i.gaps.join(', ')})` : ''}`)
              .join('\n');
            throw new Error(
              `Not published — this version is incomplete, so customers could be shown an unapproved price:\n${gaps}`
            );
          }
        }
      }
      const { error } = await supabase.rpc('publish_pricing_version', { _version_id: id });
      if (error) throw error;
      // Record who pushed it live so a historical price is always attributable.
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        await supabase
          .from('pricing_matrix_versions')
          .update({ published_by: authData.user.id } as any)
          .eq('id', id);
      }
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

