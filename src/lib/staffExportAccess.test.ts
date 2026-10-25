import { describe, expect, it } from 'vitest';
import { canUseStaffExport, canUseFullStaffExport, staffExportRows, staffExportCutoff } from './staffExportAccess';

describe('staff export safeguards', () => {
  it('blocks sales by default', () => {
    expect(canUseStaffExport('sales')).toBe(false);
    expect(staffExportRows([{ date: '2026-10-22' }], 'sales', row => row.date)).toEqual([]);
  });
  it('blocks sales leads from all exports', () => {
    expect(canUseStaffExport('sales_lead')).toBe(false);
    expect(canUseFullStaffExport('sales_lead')).toBe(false);
    expect(staffExportRows([{ date: '2026-10-22' }], 'sales_lead', row => row.date)).toEqual([]);
  });
  it('clamps two-month subtraction at month end', () => {
    expect(staffExportCutoff(new Date('2026-04-30T12:00:00Z')).toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });
  it('only admins and super admins retain default historical export', () => {
    for (const role of ['admin', 'super_admin']) {
      expect(staffExportRows([{ date: '2025-01-01' }], role, row => row.date)).toHaveLength(1);
    }
  });
  it('denies every other staff role without the dedicated grant', () => {
    for (const role of ['sales_manager', 'performance_manager', 'accounts', 'accounts_manager', 'lead_gen', 'dev_tester', 'claims_manager']) {
      expect(canUseStaffExport(role)).toBe(false);
      expect(canUseFullStaffExport(role)).toBe(false);
    }
  });
  it('explicit export grants allow both exports without broadening the supplied rows', () => {
    for (const role of ['sales', 'sales_lead', 'sales_manager', 'accounts']) {
      expect(canUseStaffExport(role, true)).toBe(true);
      expect(canUseFullStaffExport(role, true)).toBe(true);
      expect(staffExportRows([{ date: '2025-01-01' }], role, row => row.date, new Date(), true)).toHaveLength(1);
    }
  });
  it('fails closed for missing or customer roles', () => {
    expect(canUseStaffExport(undefined)).toBe(false);
    expect(canUseFullStaffExport('customer')).toBe(false);
  });
});