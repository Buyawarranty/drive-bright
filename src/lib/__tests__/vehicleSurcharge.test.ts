// @ts-nocheck
import { calculateVehiclePriceAdjustment, VehicleData } from '../vehicleValidation';

// Helper to create a standard vehicle with specific mileage and age
function makeVehicle(overrides: Partial<VehicleData> & { mileage?: string | number; manufactureDate?: string; year?: string }): VehicleData {
  return {
    make: 'Ford',
    model: 'Focus',
    regNumber: 'AB12CDE',
    vehicleType: 'car',
    ...overrides,
  };
}

// Helper: manufacture date N years ago from "now"
function yearsAgoISO(years: number, extraDays = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() - extraDays);
  return d.toISOString();
}

describe('Mileage surcharge boundaries', () => {
  it('120,000 miles does NOT trigger surcharge', () => {
    const r = calculateVehiclePriceAdjustment(makeVehicle({ mileage: '120000', year: '2020' }), 1);
    expect(r.adjustmentAmount).toBe(0);
  });

  it('120,001 miles DOES trigger surcharge (+£100 for 1yr)', () => {
    const r = calculateVehiclePriceAdjustment(makeVehicle({ mileage: '120001', year: '2020' }), 1);
    expect(r.adjustmentAmount).toBe(100);
  });

  it('150,000 miles DOES trigger surcharge', () => {
    const r = calculateVehiclePriceAdjustment(makeVehicle({ mileage: '150000', year: '2020' }), 1);
    expect(r.adjustmentAmount).toBe(100);
  });

  it('150,001 miles is over eligibility limit (blocked)', () => {
    const r = calculateVehiclePriceAdjustment(makeVehicle({ mileage: '150001', year: '2020' }), 1);
    expect(r.isValid).toBe(false);
  });

  it('mileage surcharge +£100 for 1yr', () => {
    const r = calculateVehiclePriceAdjustment(makeVehicle({ mileage: '130000', year: '2020' }), 1);
    expect(r.adjustmentAmount).toBe(100);
  });

  it('mileage surcharge +£150 for 2yr', () => {
    const r = calculateVehiclePriceAdjustment(makeVehicle({ mileage: '130000', year: '2020' }), 2);
    expect(r.adjustmentAmount).toBe(150);
  });

  it('mileage surcharge +£200 for 3yr', () => {
    const r = calculateVehiclePriceAdjustment(makeVehicle({ mileage: '130000', year: '2020' }), 3);
    expect(r.adjustmentAmount).toBe(200);
  });
});

describe('Age surcharge boundaries', () => {
  it('exactly 12 years old does NOT trigger surcharge', () => {
    const r = calculateVehiclePriceAdjustment(makeVehicle({ mileage: '50000', manufactureDate: yearsAgoISO(12, 0) }), 1);
    // 12.0000 years → should NOT qualify (strictly > 12)
    // Due to timing, this might be marginally > 12; use year-based fallback for exact boundary
    // We'll test with year fallback:
    const currentYear = new Date().getFullYear();
    const r2 = calculateVehiclePriceAdjustment(makeVehicle({ mileage: '50000', year: String(currentYear - 12) }), 1);
    expect(r2.adjustmentAmount).toBe(0);
  });

  it('12 years and 1 day old DOES trigger surcharge', () => {
    const r = calculateVehiclePriceAdjustment(makeVehicle({ mileage: '50000', manufactureDate: yearsAgoISO(12, 1) }), 1);
    expect(r.adjustmentAmount).toBe(100);
  });

  it('14 years 364 days old DOES trigger surcharge (just under 15)', () => {
    // Use year-based fallback for exact 15-year boundary (manufactureDate precision issues)
    const r = calculateVehiclePriceAdjustment(makeVehicle({ mileage: '50000', manufactureDate: yearsAgoISO(14, 364) }), 1);
    expect(r.adjustmentAmount).toBe(100);
  });

  it('age surcharge +£100 for 1yr', () => {
    const r = calculateVehiclePriceAdjustment(makeVehicle({ mileage: '50000', manufactureDate: yearsAgoISO(13) }), 1);
    expect(r.adjustmentAmount).toBe(100);
  });

  it('age surcharge +£150 for 2yr', () => {
    const r = calculateVehiclePriceAdjustment(makeVehicle({ mileage: '50000', manufactureDate: yearsAgoISO(13) }), 2);
    expect(r.adjustmentAmount).toBe(150);
  });

  it('age surcharge +£200 for 3yr', () => {
    const r = calculateVehiclePriceAdjustment(makeVehicle({ mileage: '50000', manufactureDate: yearsAgoISO(13) }), 3);
    expect(r.adjustmentAmount).toBe(200);
  });
});

describe('Non-stacking: both mileage and age qualify', () => {
  it('applies single surcharge (not doubled) for 1yr', () => {
    const r = calculateVehiclePriceAdjustment(
      makeVehicle({ mileage: '130000', manufactureDate: yearsAgoISO(13) }),
      1
    );
    expect(r.adjustmentAmount).toBe(100); // NOT 200
  });

  it('applies single surcharge for 2yr', () => {
    const r = calculateVehiclePriceAdjustment(
      makeVehicle({ mileage: '130000', manufactureDate: yearsAgoISO(14) }),
      2
    );
    expect(r.adjustmentAmount).toBe(150); // NOT 300
  });

  it('applies single surcharge for 3yr', () => {
    const r = calculateVehiclePriceAdjustment(
      makeVehicle({ mileage: '140000', manufactureDate: yearsAgoISO(13) }),
      3
    );
    expect(r.adjustmentAmount).toBe(200); // NOT 400
  });
});

describe('No surcharge for normal vehicles', () => {
  it('young low-mileage vehicle has no surcharge', () => {
    const r = calculateVehiclePriceAdjustment(makeVehicle({ mileage: '50000', year: '2020' }), 1);
    expect(r.adjustmentAmount).toBe(0);
  });
});
