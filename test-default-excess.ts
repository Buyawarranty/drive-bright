import { getDefaultVoluntaryExcess } from './src/lib/pricing/getDefaultVoluntaryExcess';

const vehicles = [
  { make: 'Ford', model: 'Fiesta', year: '2020', mileage: '30000', vehicleType: 'car', fuelType: 'Petrol' },
  { make: 'Audi', model: 'A3', year: '2015', mileage: '100000', vehicleType: 'car', fuelType: 'Diesel' },
  { make: 'BMW', model: '320d', year: '2012', mileage: '150000', vehicleType: 'car', fuelType: 'Diesel' },
];

for (const v of vehicles) {
  const excess = getDefaultVoluntaryExcess(v);
  console.log(`${v.make} ${v.model} ${v.year} ${v.mileage}: default excess £${excess}`);
}
