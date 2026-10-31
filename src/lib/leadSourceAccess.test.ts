import { describe, expect, it } from 'vitest';
import { canDisplayLeadSource, canDisplayOrrSource, hasDefaultLeadSourceAccess } from './leadSourceAccess';

describe('Lead source permission', () => {
  it('shows sources when the protected permission is on', () => {
    expect(canDisplayLeadSource(true, 'lead_gen')).toBe(true);
  });
  it('hides sources when the protected permission is off', () => {
    expect(canDisplayLeadSource(false, 'lead_gen')).toBe(false);
  });
  it.each(['sales', 'sales_lead', 'sales_manager'])('never shows sources for %s even with a grant or default email', role => {
    expect(canDisplayLeadSource(true, role)).toBe(false);
    expect(hasDefaultLeadSourceAccess(role, 'ads@buyawarranty.co.uk')).toBe(false);
    expect(hasDefaultLeadSourceAccess(role, 'seo@buyawarranty.co.uk')).toBe(false);
  });
  it.each(['ads@buyawarranty.co.uk', 'SEO@buyawarranty.co.uk'])('defaults source access for %s without a grant', email => {
    expect(hasDefaultLeadSourceAccess('lead_gen', email)).toBe(true);
  });
  it('does not allow lookalike addresses or unknown roles by default', () => {
    expect(hasDefaultLeadSourceAccess('lead_gen', 'notads@buyawarranty.co.uk')).toBe(false);
    expect(canDisplayLeadSource(true, null)).toBe(false);
  });

  it('shows the Open Round Robin source only to entitled staff in the manager view', () => {
    expect(canDisplayOrrSource(true, true)).toBe(true);
    expect(canDisplayOrrSource(true, false)).toBe(false);
    expect(canDisplayOrrSource(false, true)).toBe(false);
    expect(canDisplayOrrSource(false, false)).toBe(false);
  });
  it('keeps a sales role out of the Open Round Robin source even in the manager view', () => {
    for (const role of ['sales', 'sales_lead', 'sales_manager']) {
      const entitled = canDisplayLeadSource(true, role) || hasDefaultLeadSourceAccess(role, 'ads@buyawarranty.co.uk');
      expect(canDisplayOrrSource(entitled, true)).toBe(false);
    }
  });
});