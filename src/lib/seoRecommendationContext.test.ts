import { describe, expect, it } from 'vitest';
import { buildSeoRecommendationContext, visibleSeoRequest } from './seoRecommendationContext';

describe('SEO evidence without a Semrush API', () => {
  it('keeps site and Google evidence available when there is no weekly report', () => {
    const context = buildSeoRecommendationContext({ auditedAt: '2026-10-17', performance: { clicks: 525 } }, null);
    expect(context).toContain('"clicks":525');
    expect(context).toContain('"auditedAt":"2026-10-17"');
    expect(context).toContain('"available":false');
  });
  it('includes the dated review, proposal decision and coverage gaps', () => {
    const context = buildSeoRecommendationContext({}, { status: 'partial', audit_week: '2026-10-12', report: { checkedAt: '2026-10-17T09:00:00Z', checkedPages: 107, gaps: ['Google data unavailable'] }, proposals: [{ title: 'Check careers content', page_url: 'https://buyawarranty.co.uk/careers/', evidence: 'No H1 in initial response', proposed_change: 'Review initial content', verification: 'Inspect published HTML', priority: 'High', decision: 'approved' }] });
    expect(context).toContain('"checkedPages":107');
    expect(context).toContain('"decision":"approved"');
    expect(context).toContain('Google data unavailable');
  });
  it('shows only the question while retaining evidence in the AI request', () => {
    const context = buildSeoRecommendationContext({ auditedAt: '2026-10-17' }, null);
    expect(visibleSeoRequest(`${context}What should we improve first?`)).toBe('What should we improve first?');
    expect(visibleSeoRequest('Review this page')).toBe('Review this page');
  });
});