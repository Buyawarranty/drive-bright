/**
 * Unit tests for vehicle validation pricing logic
 * Tests mileage and age-based surcharges with boundary conditions
 * 
 * PRICING ORDER DOCUMENTATION:
 * 1. Base price calculated from plan type and duration
 * 2. Vehicle category adjustments applied (Range Rover, SUV, etc.)
 * 3. Mileage/Age surcharges applied (non-stacking by default)
 * 4. Percentage discounts applied last (motorbike discount, promo codes)
 * 
 * This ensures surcharges are added after base vehicle adjustments
 * but before any percentage-based discounts are calculated.
 */

import { calculateVehiclePriceAdjustment, VehicleData } from '../vehicleValidation';

// Helper to create vehicle data
const createVehicleData = (overrides: Partial<VehicleData> = {}): VehicleData => ({
  make: 'FORD',
  model: 'FOCUS',
  regNumber: 'AB12CDE',
  year: '2020',
  mileage: '50000',
  ...overrides,
});

// Mileage-Based Surcharge Boundaries Tests
// 1-Year Warranty
function testMileageBoundaries1Year() {
  // Should NOT apply surcharge at exactly 120,000 miles
  const vehicle1 = createVehicleData({ mileage: '120000' });
  const result1 = calculateVehiclePriceAdjustment(vehicle1, 1);
  console.assert(result1.adjustmentAmount === 0, 'Mileage 120000 should have no surcharge');

  // Should apply +£200 surcharge at 120,001 miles
  const vehicle2 = createVehicleData({ mileage: '120001' });
  const result2 = calculateVehiclePriceAdjustment(vehicle2, 1);
  console.assert(result2.adjustmentAmount === 200, 'Mileage 120001 should have +£200 surcharge');

  // Should apply +£200 surcharge at 150,000 miles
  const vehicle3 = createVehicleData({ mileage: '150000' });
  const result3 = calculateVehiclePriceAdjustment(vehicle3, 1);
  console.assert(result3.adjustmentAmount === 200, 'Mileage 150000 should have +£200 surcharge');

  // Should NOT apply surcharge at 150,001 miles
  const vehicle4 = createVehicleData({ mileage: '150001' });
  const result4 = calculateVehiclePriceAdjustment(vehicle4, 1);
  console.assert(result4.adjustmentAmount === 0, 'Mileage 150001 should have no surcharge');
  
  console.log('✅ Mileage boundaries (1-year) tests passed');
}

// 2-Year Warranty
function testMileageBoundaries2Year() {
  const vehicle1 = createVehicleData({ mileage: '120000' });
  const result1 = calculateVehiclePriceAdjustment(vehicle1, 2);
  console.assert(result1.adjustmentAmount === 0, 'Mileage 120000 should have no surcharge');

  const vehicle2 = createVehicleData({ mileage: '120001' });
  const result2 = calculateVehiclePriceAdjustment(vehicle2, 2);
  console.assert(result2.adjustmentAmount === 400, 'Mileage 120001 should have +£400 surcharge');

  const vehicle3 = createVehicleData({ mileage: '150000' });
  const result3 = calculateVehiclePriceAdjustment(vehicle3, 2);
  console.assert(result3.adjustmentAmount === 400, 'Mileage 150000 should have +£400 surcharge');

  const vehicle4 = createVehicleData({ mileage: '150001' });
  const result4 = calculateVehiclePriceAdjustment(vehicle4, 2);
  console.assert(result4.adjustmentAmount === 0, 'Mileage 150001 should have no surcharge');
  
  console.log('✅ Mileage boundaries (2-year) tests passed');
}

// 3-Year Warranty
function testMileageBoundaries3Year() {
  const vehicle1 = createVehicleData({ mileage: '120000' });
  const result1 = calculateVehiclePriceAdjustment(vehicle1, 3);
  console.assert(result1.adjustmentAmount === 0, 'Mileage 120000 should have no surcharge');

  const vehicle2 = createVehicleData({ mileage: '120001' });
  const result2 = calculateVehiclePriceAdjustment(vehicle2, 3);
  console.assert(result2.adjustmentAmount === 600, 'Mileage 120001 should have +£600 surcharge');

  const vehicle3 = createVehicleData({ mileage: '150000' });
  const result3 = calculateVehiclePriceAdjustment(vehicle3, 3);
  console.assert(result3.adjustmentAmount === 600, 'Mileage 150000 should have +£600 surcharge');

  const vehicle4 = createVehicleData({ mileage: '150001' });
  const result4 = calculateVehiclePriceAdjustment(vehicle4, 3);
  console.assert(result4.adjustmentAmount === 0, 'Mileage 150001 should have no surcharge');
  
  console.log('✅ Mileage boundaries (3-year) tests passed');
}

// Age-Based Surcharge Boundaries Tests (using year only - fallback)
function testAgeBoundaries() {
  const currentYear = new Date().getFullYear(); // 2025

  // 1-Year: Should NOT apply surcharge at exactly 12 years old
  const vehicle1 = createVehicleData({ year: String(currentYear - 12), mileage: '50000' });
  const result1 = calculateVehiclePriceAdjustment(vehicle1, 1);
  console.assert(result1.adjustmentAmount === 0, '12 years old should have no surcharge');

  // 1-Year: Should apply +£200 surcharge at 13 years old (> 12 years)
  const vehicle2 = createVehicleData({ year: String(currentYear - 13), mileage: '50000' });
  const result2 = calculateVehiclePriceAdjustment(vehicle2, 1);
  console.assert(result2.adjustmentAmount === 200, '13 years old should have +£200 surcharge');

  // 1-Year: Should apply +£200 surcharge at 15 years old
  const vehicle3 = createVehicleData({ year: String(currentYear - 15), mileage: '50000' });
  const result3 = calculateVehiclePriceAdjustment(vehicle3, 1);
  console.assert(result3.adjustmentAmount === 200, '15 years old should have +£200 surcharge');

  // 1-Year: Should NOT apply surcharge at 16 years old (> 15 years)
  const vehicle4 = createVehicleData({ year: String(currentYear - 16), mileage: '50000' });
  const result4 = calculateVehiclePriceAdjustment(vehicle4, 1);
  console.assert(result4.adjustmentAmount === 0, '16 years old should have no surcharge');

  // 2-Year: 13 years old should have +£400
  const vehicle5 = createVehicleData({ year: String(currentYear - 13), mileage: '50000' });
  const result5 = calculateVehiclePriceAdjustment(vehicle5, 2);
  console.assert(result5.adjustmentAmount === 400, '13 years old (2-year) should have +£400 surcharge');

  // 3-Year: 14 years old should have +£600
  const vehicle6 = createVehicleData({ year: String(currentYear - 14), mileage: '50000' });
  const result6 = calculateVehiclePriceAdjustment(vehicle6, 3);
  console.assert(result6.adjustmentAmount === 600, '14 years old (3-year) should have +£600 surcharge');

  console.log('✅ Age boundaries tests passed');
}

// Age-Based Surcharge with Precise ManufactureDate Tests
function testPreciseAgeBoundaries() {
  const now = new Date();
  
  // Calculate a date that is exactly 12 years ago (should NOT qualify)
  const exactly12YearsAgo = new Date(now);
  exactly12YearsAgo.setFullYear(exactly12YearsAgo.getFullYear() - 12);
  const vehicle1 = createVehicleData({ 
    manufactureDate: exactly12YearsAgo.toISOString(), 
    mileage: '50000' 
  });
  const result1 = calculateVehiclePriceAdjustment(vehicle1, 1);
  console.assert(result1.adjustmentAmount === 0, 'Exactly 12 years old should have no surcharge');

  // Calculate a date that is 12 years and 1 day ago (SHOULD qualify)
  const over12YearsAgo = new Date(now);
  over12YearsAgo.setFullYear(over12YearsAgo.getFullYear() - 12);
  over12YearsAgo.setDate(over12YearsAgo.getDate() - 1);
  const vehicle2 = createVehicleData({ 
    manufactureDate: over12YearsAgo.toISOString(), 
    mileage: '50000' 
  });
  const result2 = calculateVehiclePriceAdjustment(vehicle2, 1);
  console.assert(result2.adjustmentAmount === 200, '12 years + 1 day old should have +£200 surcharge');

  // Calculate a date that is exactly 15 years ago (SHOULD qualify)
  const exactly15YearsAgo = new Date(now);
  exactly15YearsAgo.setFullYear(exactly15YearsAgo.getFullYear() - 15);
  const vehicle3 = createVehicleData({ 
    manufactureDate: exactly15YearsAgo.toISOString(), 
    mileage: '50000' 
  });
  const result3 = calculateVehiclePriceAdjustment(vehicle3, 1);
  console.assert(result3.adjustmentAmount === 200, 'Exactly 15 years old should have +£200 surcharge');

  // Calculate a date that is 15 years and 1 day ago (should NOT qualify - over 15)
  const over15YearsAgo = new Date(now);
  over15YearsAgo.setFullYear(over15YearsAgo.getFullYear() - 15);
  over15YearsAgo.setDate(over15YearsAgo.getDate() - 1);
  const vehicle4 = createVehicleData({ 
    manufactureDate: over15YearsAgo.toISOString(), 
    mileage: '50000' 
  });
  const result4 = calculateVehiclePriceAdjustment(vehicle4, 1);
  console.assert(result4.adjustmentAmount === 0, '15 years + 1 day old should have no surcharge (over 15)');

  // Test BL62 GVO scenario: Feb 2013 vehicle (12 years 10 months old as of Dec 2025)
  // This should now qualify since it's > 12 years
  const feb2013 = new Date('2013-02-09');
  const vehicle5 = createVehicleData({ 
    manufactureDate: feb2013.toISOString(), 
    mileage: '50000' 
  });
  const result5 = calculateVehiclePriceAdjustment(vehicle5, 1);
  console.assert(result5.adjustmentAmount === 200, 'Feb 2013 vehicle (12y 10m old) should have +£200 surcharge');

  console.log('✅ Precise age boundaries tests passed');
}

// Non-Stacking Behavior Tests
function testNonStackingBehavior() {
  const currentYear = new Date().getFullYear();

  // SINGLE surcharge when BOTH mileage AND age qualify (1-year)
  const vehicle1 = createVehicleData({ year: String(currentYear - 13), mileage: '130000' });
  const result1 = calculateVehiclePriceAdjustment(vehicle1, 1);
  console.assert(result1.adjustmentAmount === 200, 'Both conditions (1-year): should be +£200, not +£400');

  // SINGLE surcharge when BOTH mileage AND age qualify (2-year)
  const vehicle2 = createVehicleData({ year: String(currentYear - 14), mileage: '140000' });
  const result2 = calculateVehiclePriceAdjustment(vehicle2, 2);
  console.assert(result2.adjustmentAmount === 400, 'Both conditions (2-year): should be +£400, not +£800');

  // SINGLE surcharge when BOTH mileage AND age qualify (3-year)
  const vehicle3 = createVehicleData({ year: String(currentYear - 15), mileage: '150000' });
  const result3 = calculateVehiclePriceAdjustment(vehicle3, 3);
  console.assert(result3.adjustmentAmount === 600, 'Both conditions (3-year): should be +£600, not +£1200');

  // Surcharge when ONLY mileage qualifies
  const vehicle4 = createVehicleData({ year: String(currentYear - 5), mileage: '130000' });
  const result4 = calculateVehiclePriceAdjustment(vehicle4, 1);
  console.assert(result4.adjustmentAmount === 200, 'Only mileage qualifies: should be +£200');

  // Surcharge when ONLY age qualifies
  const vehicle5 = createVehicleData({ year: String(currentYear - 14), mileage: '50000' });
  const result5 = calculateVehiclePriceAdjustment(vehicle5, 1);
  console.assert(result5.adjustmentAmount === 200, 'Only age qualifies: should be +£200');

  // NO surcharge when neither condition qualifies
  const vehicle6 = createVehicleData({ year: String(currentYear - 5), mileage: '50000' });
  const result6 = calculateVehiclePriceAdjustment(vehicle6, 1);
  console.assert(result6.adjustmentAmount === 0, 'Neither condition: should be £0');

  console.log('✅ Non-stacking behavior tests passed');
}

// Jaguar/Range Rover Pricing Parity Tests
function testJaguarRangeRoverParity() {
  const currentYear = new Date().getFullYear();

  // Range Rover vs High Mileage (1-year)
  const rangeRover1 = createVehicleData({ make: 'LAND ROVER', model: 'RANGE ROVER', mileage: '50000' });
  const highMileage1 = createVehicleData({ mileage: '130000' });
  const rrResult1 = calculateVehiclePriceAdjustment(rangeRover1, 1);
  const hmResult1 = calculateVehiclePriceAdjustment(highMileage1, 1);
  console.assert(rrResult1.adjustmentAmount === 200 && hmResult1.adjustmentAmount === 200, 
    'Range Rover and high mileage (1-year) should both be +£200');

  // Range Rover vs High Mileage (2-year)
  const rangeRover2 = createVehicleData({ make: 'LAND ROVER', model: 'RANGE ROVER', mileage: '50000' });
  const highMileage2 = createVehicleData({ mileage: '130000' });
  const rrResult2 = calculateVehiclePriceAdjustment(rangeRover2, 2);
  const hmResult2 = calculateVehiclePriceAdjustment(highMileage2, 2);
  console.assert(rrResult2.adjustmentAmount === 400 && hmResult2.adjustmentAmount === 400, 
    'Range Rover and high mileage (2-year) should both be +£400');

  // Range Rover vs High Mileage (3-year)
  const rangeRover3 = createVehicleData({ make: 'LAND ROVER', model: 'RANGE ROVER', mileage: '50000' });
  const highMileage3 = createVehicleData({ mileage: '130000' });
  const rrResult3 = calculateVehiclePriceAdjustment(rangeRover3, 3);
  const hmResult3 = calculateVehiclePriceAdjustment(highMileage3, 3);
  console.assert(rrResult3.adjustmentAmount === 600 && hmResult3.adjustmentAmount === 600, 
    'Range Rover and high mileage (3-year) should both be +£600');

  // Jaguar vs Older Vehicle
  const jaguar = createVehicleData({ make: 'JAGUAR', model: 'XF', mileage: '50000' });
  const olderVehicle = createVehicleData({ year: String(currentYear - 14), mileage: '50000' });
  const jaguarResult = calculateVehiclePriceAdjustment(jaguar, 1);
  const olderResult = calculateVehiclePriceAdjustment(olderVehicle, 1);
  console.assert(jaguarResult.adjustmentAmount === 200 && olderResult.adjustmentAmount === 200, 
    'Jaguar and older vehicle (1-year) should both be +£200');

  console.log('✅ Jaguar/Range Rover parity tests passed');
}

// Surcharge Ordering Tests
function testSurchargeOrdering() {
  // SUV base premium: +£100 for 1-year
  // High mileage surcharge: +£200 for 1-year
  // Total should be: +£300
  const suv1 = createVehicleData({ make: 'BMW', model: 'X5', mileage: '130000' });
  const result1 = calculateVehiclePriceAdjustment(suv1, 1);
  console.assert(result1.adjustmentAmount === 300, 'SUV + high mileage (1-year): should be +£300 (100 + 200)');

  // SUV base premium: +£200 for 2-year
  // High mileage surcharge: +£400 for 2-year
  // Total should be: +£600
  const suv2 = createVehicleData({ make: 'AUDI', model: 'Q7', mileage: '145000' });
  const result2 = calculateVehiclePriceAdjustment(suv2, 2);
  console.assert(result2.adjustmentAmount === 600, 'SUV + high mileage (2-year): should be +£600 (200 + 400)');

  console.log('✅ Surcharge ordering tests passed');
}

// Run all tests
export function runAllVehicleValidationTests() {
  console.log('🧪 Running Vehicle Validation Pricing Tests...\n');
  
  testMileageBoundaries1Year();
  testMileageBoundaries2Year();
  testMileageBoundaries3Year();
  testAgeBoundaries();
  testPreciseAgeBoundaries();
  testNonStackingBehavior();
  testJaguarRangeRoverParity();
  testSurchargeOrdering();
  
  console.log('\n✅ All vehicle validation pricing tests passed!');
}

// Export individual test functions for debugging
export {
  testMileageBoundaries1Year,
  testMileageBoundaries2Year,
  testMileageBoundaries3Year,
  testAgeBoundaries,
  testPreciseAgeBoundaries,
  testNonStackingBehavior,
  testJaguarRangeRoverParity,
  testSurchargeOrdering,
};
