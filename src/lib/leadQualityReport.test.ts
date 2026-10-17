import { describe, expect, it } from 'vitest';
import { qualityCategories, qualityCount, qualityTotal, type QualityRow } from './leadQualityReport';
describe('lead-quality counts', () => {
  const rows: QualityRow[] = [{source:'google',total:10,statuses:{callback_booked:3,fake_lead:2,lost:1,new:4},activities:{callbacks:5,paid:2}}, {source:'facebook',total:5,statuses:{callback_booked:1,wrong_number:2,new:2},activities:{callbacks:3,paid:1}}];
  it('includes fake and dead in the received total without adding overlapping activities', () => { expect(qualityTotal(rows)).toBe(15); });
  it('counts callbacks booked separately from callback requests', () => { expect(qualityCount(rows,'callback_booked')).toBe(4); expect(qualityCount(rows,'callbacks',true)).toBe(8); });
  it('retains every recorded status', () => { expect(qualityCategories([{source:'other',total:1,statuses:{future_status:1},activities:{}}]).map(([key])=>key)).toContain('future_status'); });
});