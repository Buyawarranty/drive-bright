import { describe, expect, it } from 'vitest';
import { yearlySaleRevenue, collectedAnniversaryRevenue } from './bawPayLater';

describe('BAW PayLater collected revenue and commission basis', () => {
  it('credits £502, not £1004, on a two-year sale', () => {
    expect(yearlySaleRevenue({ baw_paylater: true, baw_paylater_yearly_amount: 502, final_amount: 1004 })).toBe(502);
  });
  it('does not divide an already-yearly £502 again', () => {
    expect(yearlySaleRevenue({ baw_paylater: true, final_amount: 502 })).toBe(502);
  });
  it('credits the same one-year amount for three-year cover', () => {
    expect(yearlySaleRevenue({ baw_paylater: true, baw_paylater_yearly_amount: 502, final_amount: 1506 })).toBe(502);
  });
  it('keeps ordinary full-payment revenue unchanged', () => {
    expect(yearlySaleRevenue({ baw_paylater: false, baw_paylater_yearly_amount: 502, final_amount: 1004 })).toBe(1004);
  });
  const row = { customer_id: 'sale', year_number: 2, status: 'paid', paid_at: '2027-10-20T12:00:00Z', paid_amount: 502, amount: 502 };
  it('recognises £502 for year two only after collection', () => {
    expect(collectedAnniversaryRevenue({ ...row, status: 'pending', paid_at: null })).toBe(0);
    expect(collectedAnniversaryRevenue(row)).toBe(502);
  });
  it('never counts the first yearly payment twice', () => {
    expect(collectedAnniversaryRevenue({ ...row, year_number: 1 })).toBe(0);
  });
  it('uses actual collected money, including zero, instead of the amount due', () => {
    expect(collectedAnniversaryRevenue({ ...row, paid_amount: 400 })).toBe(400);
    expect(collectedAnniversaryRevenue({ ...row, paid_amount: 0 })).toBe(0);
  });
  it('bases percentage commission on £502 rather than £1004', () => {
    const basis = yearlySaleRevenue({ baw_paylater: true, baw_paylater_yearly_amount: 502, final_amount: 1004 });
    expect(basis * 0.1).toBeCloseTo(50.2);
  });
});