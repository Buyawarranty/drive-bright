import { describe, it, expect } from 'vitest';
import { matchModelFloor } from '@/lib/pricing/modelFloorMatch';
import { PROPOSED_MODEL_FLOORS } from '@/components/admin/pricing/AgeBandPricingPreview';
describe('floor match', () => {
  it('handles messy input', () => {
    expect(matchModelFloor('TeslaX tesla', PROPOSED_MODEL_FLOORS)?.floor.key).toBe('tesla');
    expect(matchModelFloor('RANGE ROVER SPORT HSE', PROPOSED_MODEL_FLOORS)?.floor.key).toBe('rr-sport');
    expect(matchModelFloor('BMW M3 Competition', PROPOSED_MODEL_FLOORS)?.floor.key).toBe('bmw-m');
    expect(matchModelFloor('Ford Focus', PROPOSED_MODEL_FLOORS)).toBeNull();
    expect(matchModelFloor('Audi R8', PROPOSED_MODEL_FLOORS)?.floor.covered).toBe(false);
  });
});
