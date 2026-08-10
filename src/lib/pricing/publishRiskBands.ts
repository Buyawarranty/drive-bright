/**
 * PUSH-LIVE for vehicle type & model-risk bands.
 * Kept apart from the pure pricing helpers so the pricing engine never pulls in
 * the Supabase client.
 */
import { supabase } from '@/integrations/supabase/client';
import { setLiveRiskBandConfig } from './liveRiskBands';
import type { RiskBandConfig } from './vehicleRiskBands';

export interface PublishRiskBandsResult {
  published: boolean;
  /** Label of the live pricing version the bands were attached to. */
  versionLabel?: string;
  reason?: string;
}

/**
 * Attach the band config to whatever pricing version is live right now and apply
 * it in this tab immediately. Nothing else about the live version is touched.
 */
export async function publishRiskBandsToLiveVersion(
  config: RiskBandConfig
): Promise<PublishRiskBandsResult> {
  const { data, error } = await supabase
    .from('pricing_matrix_versions')
    .select('id, label, vehicle_factor_model')
    .eq('status', 'live')
    .order('published_at', { ascending: false })
    .limit(1);

  if (error) return { published: false, reason: error.message };
  const live = data?.[0];
  if (!live) {
    return {
      published: false,
      reason: 'No pricing version is live yet — publish a pricing version first.',
    };
  }

  const existing = (live.vehicle_factor_model as Record<string, unknown> | null) ?? {};
  const nextModel = { ...existing, riskBands: config };

  const { error: updateError } = await supabase
    .from('pricing_matrix_versions')
    .update({ vehicle_factor_model: nextModel as never })
    .eq('id', live.id);

  if (updateError) return { published: false, reason: updateError.message };

  setLiveRiskBandConfig(config);
  return { published: true, versionLabel: live.label };
}

/** Label of the pricing version currently live, for the push-live bar. */
export async function fetchLivePricingVersionLabel(): Promise<string | null> {
  const { data } = await supabase
    .from('pricing_matrix_versions')
    .select('label, published_at')
    .eq('status', 'live')
    .order('published_at', { ascending: false })
    .limit(1);
  return data?.[0]?.label ?? null;
}
