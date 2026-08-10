/**
 * Single client-side guard for the excluded-vehicle matrix.
 *
 * Every reg-lookup surface (homepage hero, A/B homepages, brand landing pages)
 * must call this before handing the vehicle to the quote journey. Previously
 * these surfaces only *flagged* `blocked` on the vehicle payload and carried on,
 * which let excluded makes (e.g. Bentley) reach Step 3 and get a price.
 */
import { isVehicleExcluded } from '@/lib/vehicleExclusions';

export const VEHICLE_BLOCK_MESSAGE =
  "Sorry, we're unable to cover high-performance, luxury or specialist vehicles.";

interface LookupLike {
  found?: boolean;
  blocked?: boolean;
  blockReason?: string | null;
  make?: string | null;
  model?: string | null;
}

/** Returns a customer-facing message when the vehicle must not be quoted, else null. */
export const getVehicleBlockMessage = (data?: LookupLike | null): string | null => {
  if (!data) return null;
  if (data.blocked) return data.blockReason || VEHICLE_BLOCK_MESSAGE;
  if (isVehicleExcluded(data.make, data.model)) return VEHICLE_BLOCK_MESSAGE;
  return null;
};
