import { DEFAULT_RISK_BAND_ASSIGNMENTS, DEFAULT_RISK_BAND_CONFIG, matchRiskBand, applyRiskBand } from '../src/lib/pricing/vehicleRiskBands';
import { isVehicleExcluded, getExclusionReason } from '../src/lib/vehicleExclusions';
for (const a of DEFAULT_RISK_BAND_ASSIGNMENTS) {
  const ex = isVehicleExcluded(a.make, a.model);
  const m = matchRiskBand(a.make, a.model, DEFAULT_RISK_BAND_CONFIG);
  const p = applyRiskBand(500, m, 'car', DEFAULT_RISK_BAND_CONFIG);
  console.log([ex ? 'CLASH' : 'ok', a.make, a.model, m.band.name, p.price, ex ? getExclusionReason(a.make, a.model) : ''].join(' | '));
}
