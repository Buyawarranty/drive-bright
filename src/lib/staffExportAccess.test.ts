import { describe, expect, it } from 'vitest';
import { canUseStaffExport, canUseFullStaffExport, staffExportRows, staffExportCutoff } from './staffExportAccess';

describe('staff export safeguards', () => {
  it('blocks sales regardless of an export permission override', () => {
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
  it('retains historical export for existing authorised staff roles', () => {
    for (const role of ['admin', 'super_admin', 'sales_manager', 'performance_manager', 'accounts', 'accounts_manager', 'lead_gen']) {
      expect(staffExportRows([{ date: '2025-01-01' }], role, row => row.date)).toHaveLength(1);
    }
  });
  it('fails closed for missing or customer roles', () => {
    expect(canUseStaffExport(undefined)).toBe(false);
    expect(canUseFullStaffExport('customer')).toBe(false);
  });
});