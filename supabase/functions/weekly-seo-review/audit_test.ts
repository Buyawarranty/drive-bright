import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { inspectHtml, verifiedProperties } from './audit.ts';
Deno.test('weekly review proposes corrections without rewriting approved HTML', () => {
  const html = '<title>Approved title</title><h1>Warranty</h1><img src="car.jpg"><img src="icon.svg" alt="">';
  const result = inspectHtml('https://buyawarranty.co.uk/', html);
  assertEquals(result.proposals.filter(p => p.category === 'Image descriptions').length, 1);
  assertEquals(result.page.title, 'Approved title');
  assertEquals(result.page.emptyAlt, 1);
});
Deno.test('Google property selection retains every verified match without choosing one', () => {
  assertEquals(verifiedProperties([{ siteUrl: 'https://buyawarranty.co.uk/' }, { siteUrl: 'sc-domain:buyawarranty.co.uk' }, { siteUrl: 'https://other.co.uk/' }, { siteUrl: 'https://buyawarranty.co.uk/private/', permissionLevel: 'siteUnverifiedUser' }]), ['https://buyawarranty.co.uk/', 'sc-domain:buyawarranty.co.uk']);
});