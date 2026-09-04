---
name: EV / hybrid category pricing
description: One uplift + one 12-month minimum per powertrain (EV, PHEV, HEV) with per-make/model exclusions, applied on top of model-risk bands
type: feature
---
Price updates → "Category price — electric & hybrid" sets, per powertrain group:
- `enabled`, `factor` (uplift on standard price), `minOneYear` (nullable), `excludes[{make, model}]`
- Groups are separate: EV, PHEV (plug-in hybrid), HEV (full hybrid) — hybrids never move with EVs.

Stored inside `RiskBandConfig.powertrains` (`src/lib/pricing/vehicleRiskBands.ts`), so it travels with the risk bands when pushed live (inside the live pricing version's `vehicle_factor_model.riskBands`).

Order: age base × mileage × category uplift × vehicle type × model-risk band, then the HIGHEST of band minimum, category minimum and global minimum (motorbikes halve floors).

Fuel comes from DVLA text via `normalizeFuelCategory`; unknown fuel never gets a category price. Excluded make/model prices exactly like a petrol car on its band alone.
