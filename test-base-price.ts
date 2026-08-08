import { getVehiclePriceFactor } from './src/lib/pricing/vehicleFactorModel';
import { calculateVehiclePriceAdjustment, applyPriceAdjustment, isMotorbikeAdjustment } from './src/lib/vehicleValidation';
import { getBaseClaimLimit } from './src/lib/claimLimitTiers';
import {
  getBasePrice as getCentralizedBasePrice,
  applyBasePriceFloor,
  applyReliableBrandDiscount,
} from './src/lib/pricingMatrix';

const vehicle = { make: 'Ford', model: 'Fiesta', year: '2020', mileage: '30000', vehicleType: 'car', fuelType: 'Petrol' };
const paymentPeriod: '12months' | '24months' | '36months' = '24months';
const warrantyYears = 2;
const vehicleAdjustment = calculateVehiclePriceAdjustment(vehicle, warrantyYears);
const rawBase = getCentralizedBasePrice(paymentPeriod, 100, getBaseClaimLimit(2000), 'customer', getVehiclePriceFactor(vehicle));
const basePrice = applyReliableBrandDiscount(rawBase, vehicle?.make, vehicle?.fuelType);
const adjustedPrice = applyPriceAdjustment(basePrice, vehicleAdjustment);
const flooredBase = applyBasePriceFloor(adjustedPrice, paymentPeriod, 100, isMotorbikeAdjustment(vehicleAdjustment), 'customer', [vehicle?.make, vehicle?.model].filter(Boolean).join(' ') || null, 2000);
console.log('Raw base:', rawBase, 'Base price:', basePrice, 'Adjusted:', adjustedPrice, 'Floored:', flooredBase);
