import type { Plugin } from 'vite';

// Canonical upload pointers stay untouched; every JSON importer gets a portable URL.
export const ASSET_ORIGIN = 'https://drive-bright.lovable.app';
export function portableAssetPointer(pointer: Record<string, unknown>) {
  const url = pointer.url;
  return typeof url === 'string' && url.startsWith('/__l5e/assets-v1/')
    ? { ...pointer, url: `${ASSET_ORIGIN}${url}` }
    : pointer;
}

export function portableAssetsPlugin(): Plugin {
  return {
    name: 'portable-lovable-assets',
    enforce: 'pre',
    transform(source, id) {
      const file = id.split('?')[0];
      if (!file.endsWith('.asset.json')) return null;
      return { code: JSON.stringify(portableAssetPointer(JSON.parse(source))), map: null };
    },
  };
}