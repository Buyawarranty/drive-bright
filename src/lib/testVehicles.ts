// Internal test vehicles. These are staff test records and must never appear in
// customer-facing analytics (claims by make/model, vehicle intelligence, etc.).
export const TEST_VEHICLE_REGS = [
  'B11CSD', // Test vehicle (Audi Q5) used for claim/quote testing
];

export const normaliseReg = (v?: string | null) =>
  (v || '').toUpperCase().replace(/\s+/g, '');

export const isTestVehicleReg = (reg?: string | null) =>
  TEST_VEHICLE_REGS.includes(normaliseReg(reg));

/** Drop claims/records that belong to an internal test vehicle. */
export function excludeTestVehicles<T extends { vehicle_registration?: string | null }>(rows: T[]): T[] {
  return (rows || []).filter(r => !isTestVehicleReg(r.vehicle_registration));
}
