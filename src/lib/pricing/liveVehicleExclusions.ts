/**
 * Published (pushed-live) vehicle exclusion extras.
 *
 * The hardcoded matrix in `src/lib/vehicleExclusions.ts` is always enforced.
 * This layer lets a manager add extra excluded makes / model keywords in the
 * admin, keep them as a draft, then push them live for every quoting surface
 * (Steps 1-4, Quotes & Orders, DVLA lookup) exactly like a pricing version.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  setLiveExclusionExtras,
  type LiveExclusionExtras,
} from '@/lib/vehicleExclusions';

export interface ExclusionModelRuleDraft {
  make?: string | null;
  model: string;
  label?: string | null;
}

export interface ExclusionDraft {
  makes: string[];
  modelRules: ExclusionModelRuleDraft[];
}

export interface PublishedExclusionVersion {
  id: string;
  label: string;
  extra_makes: string[];
  extra_model_rules: ExclusionModelRuleDraft[];
  pricing_version_label: string | null;
  published_at: string;
}

const DRAFT_KEY = 'baw:exclusions:draft:v1';

export const emptyExclusionDraft = (): ExclusionDraft => ({ makes: [], modelRules: [] });

export const loadExclusionDraft = (): ExclusionDraft => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyExclusionDraft();
    const parsed = JSON.parse(raw);
    return {
      makes: Array.isArray(parsed?.makes) ? parsed.makes : [],
      modelRules: Array.isArray(parsed?.modelRules) ? parsed.modelRules : [],
    };
  } catch {
    return emptyExclusionDraft();
  }
};

export const saveExclusionDraft = (draft: ExclusionDraft): void => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable — draft stays in memory only */
  }
};

/** Fetch the live published version (or null when nothing has been pushed live). */
export const fetchLiveExclusionVersion = async (): Promise<PublishedExclusionVersion | null> => {
  const { data, error } = await supabase
    .from('vehicle_exclusion_versions')
    .select('id,label,extra_makes,extra_model_rules,pricing_version_label,published_at')
    .eq('status', 'live')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    label: data.label as string,
    extra_makes: (data.extra_makes as unknown as string[]) ?? [],
    extra_model_rules: (data.extra_model_rules as unknown as ExclusionModelRuleDraft[]) ?? [],
    pricing_version_label: (data.pricing_version_label as string | null) ?? null,
    published_at: data.published_at as string,
  };
};

/** Load the live version and apply it to the exclusion checks used everywhere. */
export const primeLiveExclusions = async (): Promise<PublishedExclusionVersion | null> => {
  const live = await fetchLiveExclusionVersion();
  const extras: LiveExclusionExtras = {
    makes: live?.extra_makes ?? [],
    modelRules: live?.extra_model_rules ?? [],
    label: live?.label ?? null,
    publishedAt: live?.published_at ?? null,
  };
  setLiveExclusionExtras(extras);
  return live;
};

/** Push the current draft live. Previous live versions are archived. */
export const publishExclusions = async (
  draft: ExclusionDraft,
  label: string,
  pricingVersionLabel?: string | null
): Promise<PublishedExclusionVersion> => {
  const { data: authData } = await supabase.auth.getUser();

  const { error: archiveError } = await supabase
    .from('vehicle_exclusion_versions')
    .update({ status: 'archived' })
    .eq('status', 'live');
  if (archiveError) throw archiveError;

  const { data, error } = await supabase
    .from('vehicle_exclusion_versions')
    .insert({
      label,
      status: 'live',
      extra_makes: draft.makes as any,
      extra_model_rules: draft.modelRules as any,
      pricing_version_label: pricingVersionLabel ?? null,
      published_by: authData?.user?.id ?? null,
    })
    .select('id,label,extra_makes,extra_model_rules,pricing_version_label,published_at')
    .single();
  if (error) throw error;

  setLiveExclusionExtras({
    makes: draft.makes,
    modelRules: draft.modelRules,
    label,
    publishedAt: data.published_at as string,
  });

  return {
    id: data.id as string,
    label: data.label as string,
    extra_makes: (data.extra_makes as unknown as string[]) ?? [],
    extra_model_rules: (data.extra_model_rules as unknown as ExclusionModelRuleDraft[]) ?? [],
    pricing_version_label: (data.pricing_version_label as string | null) ?? null,
    published_at: data.published_at as string,
  };
};

/** True when the draft differs from what is live. */
export const exclusionDraftDiffersFromLive = (
  draft: ExclusionDraft,
  live: PublishedExclusionVersion | null
): boolean => {
  const norm = (d: ExclusionDraft) =>
    JSON.stringify({
      makes: [...d.makes].map(m => m.trim().toLowerCase()).sort(),
      modelRules: [...d.modelRules]
        .map(r => `${(r.make || '').trim().toLowerCase()}|${r.model.trim().toLowerCase()}`)
        .sort(),
    });
  return (
    norm(draft) !==
    norm({ makes: live?.extra_makes ?? [], modelRules: live?.extra_model_rules ?? [] })
  );
};

/**
 * Re-publish the exclusion list alongside a pricing version.
 *
 * Called automatically from every section "Push live" so the excluded vehicle
 * list can never lag behind the live pricing version. Uses the manager's local
 * draft when it has content, otherwise re-stamps whatever is already live.
 * Failures are swallowed — a pricing push must never be blocked by this.
 */
export const autoPublishExclusionsWithPricing = async (
  pricingVersionLabel: string
): Promise<void> => {
  try {
    const draft = loadExclusionDraft();
    const live = await fetchLiveExclusionVersion();
    const toPublish: ExclusionDraft =
      draft.makes.length > 0 || draft.modelRules.length > 0
        ? draft
        : { makes: live?.extra_makes ?? [], modelRules: live?.extra_model_rules ?? [] };
    const label = `Exclusions with ${pricingVersionLabel}`;
    await publishExclusions(toPublish, label, pricingVersionLabel);
  } catch {
    /* non-blocking: built-in matrix stays enforced regardless */
  }
};
