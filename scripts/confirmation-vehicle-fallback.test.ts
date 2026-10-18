import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Exercise the actual inline expressions without invoking payment processing or sending email.
const source = readFileSync(new URL('../supabase/functions/handle-successful-payment/index.ts', import.meta.url), 'utf8');
const start = source.indexOf('const salesEmailHtml =');
const end = source.indexOf('<h3 style="color: #333; margin-top: 20px;">Add-Ons Included</h3>', start);
const expressions = [...source.slice(start, end).matchAll(/\$\{(vehicleData\?\.[^}]+)\}/g)]
  .map(match => match[1]);
const fields = [
  ['regNumber', 'vehicle_reg', 'SDZ262'],
  ['make', 'vehicle_make', 'LAND ROVER'],
  ['model', 'vehicle_model', 'R ROVER EVOQUE RDYN SE DMHEV A'],
  ['year', 'vehicle_year', '2021'],
  ['fuelType', 'vehicle_fuel_type', 'HEAVY OIL'],
  ['mileage', 'vehicle_mileage', '42000'],
] as const;

describe('Sale email vehicle fallback', () => {
  for (const [field, metadataKey, value] of fields) {
    it(`${field} uses metadata when the payment payload omits it`, () => {
      const expression = expressions.find(item => item.startsWith(`vehicleData?.${field} ||`));
      expect(expression).toBeDefined();
      const evaluate = new Function('vehicleData', 'metadata', `return (${expression});`);
      expect(evaluate({}, { [metadataKey]: value })).toBe(value);
      expect(evaluate({ [field]: 'confirmed' }, { [metadataKey]: value })).toBe('confirmed');
      expect(evaluate(undefined, undefined)).toBe('Unknown');
    });
  }
});