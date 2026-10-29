import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASSET_ORIGIN, portableAssetPointer } from './vite-plugin-portable-assets';

function pointers(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? pointers(file) : entry.name.endsWith('.asset.json') ? [file] : [];
  });
}
describe('Portable uploaded assets', () => {
  it('makes all 118 current pointers absolute without changing asset identity or filenames', () => {
    const files = pointers('src/assets');
    expect(files).toHaveLength(118);
    for (const file of files) {
      const original = JSON.parse(readFileSync(file, 'utf8'));
      const result = portableAssetPointer(original);
      expect(result.url).toBe(`${ASSET_ORIGIN}${original.url}`);
      expect({ ...result, url: original.url }).toEqual(original);
    }
  });
  it('makes future uploads portable without editing consuming pages', () => {
    expect(portableAssetPointer({url:'/__l5e/assets-v1/new-upload/document.pdf'}).url)
      .toBe('https://drive-bright.lovable.app/__l5e/assets-v1/new-upload/document.pdf');
  });
  it('preserves already absolute pointers and ordinary local assets', () => {
    for (const url of ['https://example.com/photo.webp', '/logo.svg']) {
      expect(portableAssetPointer({url}).url).toBe(url);
    }
  });
});