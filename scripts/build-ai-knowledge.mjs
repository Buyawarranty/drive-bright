// Extracts readable text from key customer-facing pages into knowledge chunks
// for the sandbox AI chatbot. Run: bun scripts/build-ai-knowledge.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const FILES = [
  ['FAQ', 'src/pages/FAQ.tsx'],
  ['Terms and conditions', 'src/pages/Terms.tsx'],
  ['Warranty plan', 'src/pages/WarrantyPlan.tsx'],
  ['Claims', 'src/pages/Claims.tsx'],
  ['What is covered', 'src/pages/Protected.tsx'],
  ['Cancellation policy', 'src/pages/CancellationPolicy.tsx'],
  ['Privacy policy', 'src/pages/PrivacyPolicy.tsx'],
  ['Warranty transfer', 'src/pages/WarrantyTransfer.tsx'],
  ['Used car warranty UK', 'src/pages/UsedCarWarrantyUK.tsx'],
  ['Motorbike warranty', 'src/pages/MotorbikeWarranty.tsx'],
  ['EV warranty', 'src/pages/EVWarranty.tsx'],
];

function extract(src) {
  const out = [];
  // string literals that look like prose
  const re = /(?:'((?:[^'\\]|\\.){12,600})'|"((?:[^"\\]|\\.){12,600})"|`((?:[^`\\$]|\\.){12,900})`)/g;
  let m;
  while ((m = re.exec(src))) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\\'/g, "'").replace(/\\n/g, ' ').trim();
    if (!/[a-z]{3}\s+[a-z]{2}/i.test(raw)) continue;         // needs real words
    if (/[<>{}]|https?:|\.tsx?$|^[a-z-]+:|className|px-|text-|bg-|flex |grid /i.test(raw)) continue;
    out.push(raw);
  }
  // JSX text nodes
  const text = src.replace(/\{[^{}]*\}/g, ' ');
  for (const t of text.match(/>[^<>{}]{25,600}</g) || []) {
    const v = t.slice(1, -1).replace(/\s+/g, ' ').trim();
    if (/[a-z]{3}\s+[a-z]{2}/i.test(v)) out.push(v);
  }
  return [...new Set(out)].filter(
    (l) => l !== ';' && !/^import\b/.test(l) && !/^;$/.test(l) && l.length > 8
  );
}

const chunks = [];
for (const [title, path] of FILES) {
  let src = '';
  try { src = readFileSync(path, 'utf8'); } catch { continue; }
  const lines = extract(src);
  // group into ~1400 char chunks
  let buf = [];
  let len = 0;
  let part = 1;
  const flush = () => {
    if (!buf.length) return;
    chunks.push({ source: title, section: `${title} (part ${part++})`, text: buf.join('\n') });
    buf = []; len = 0;
  };
  for (const l of lines) {
    if (len + l.length > 1400) flush();
    buf.push(l); len += l.length + 1;
  }
  flush();
}

writeFileSync(
  'supabase/functions/ai-sandbox-chat/site-knowledge.json',
  JSON.stringify(chunks, null, 0)
);
console.log('chunks:', chunks.length, 'chars:', chunks.reduce((a, c) => a + c.text.length, 0));
