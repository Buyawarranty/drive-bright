// Builds the approved-material knowledge base for the sandbox AI chatbot.
//
// SOURCE OF TRUTH (nothing else):
//   1. public/Platinum-Warranty-Plan-v2.4.pdf      — latest Platinum plan document
//   2. public/Terms-and-Conditions-v2.3.pdf        — latest terms & conditions
//   3. The step 3 pricing page options (term, claim limit, excess, labour rate)
//
// Website marketing pages (FAQ, WarrantyPlan, Protected, blog, etc.) are
// deliberately NOT included — they drift from the documents and caused the
// chatbot to state cover terms that are not in the approved material.
//
// Run: bun scripts/build-ai-knowledge.mjs
// Requires `pdftotext` (poppler-utils) on PATH.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const PDFS = [
  ['Platinum Warranty Plan v2.4', 'public/Platinum-Warranty-Plan-v2.4.pdf'],
  ['Terms and Conditions v2.3', 'public/Terms-and-Conditions-v2.3.pdf'],
];

// Step 3 of the customer pricing journey — the actual options a customer picks.
const STEP3_FILES = [
  'src/components/step3/TermSelector.tsx',
  'src/components/step3/ClaimLimitSelector.tsx',
  'src/components/step3/ClaimLimitDetails.tsx',
  'src/components/step3/ExcessSelector.tsx',
  'src/components/step3/ExcessDetails.tsx',
  'src/components/step3/LabourRateSelector.tsx',
  'src/components/step3/LabourRateDetails.tsx',
  'src/components/step3/WhatsCoveredAccordion.tsx',
  'src/components/step3/WhatsNotCoveredAccordion.tsx',
  'src/components/step3/PolicyTermsAccordion.tsx',
  'src/components/step3/PartsListContent.tsx',
  'src/components/step3/CheckoutFAQ.tsx',
  'src/components/step3/ExtrasSelector.tsx',
];

function pdfLines(path) {
  const raw = execFileSync('pdftotext', ['-layout', path, '-'], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00a0/g, ' ').replace(/[¾¿½]/g, "'").replace(/\s{3,}/g, '  ').trim())
    .filter((l) => l && l !== '×' && !/^Page \d+/i.test(l) && l.length > 2);
}

function extractTsx(src) {
  const out = [];
  const re = /(?:'((?:[^'\\]|\\.){12,600})'|"((?:[^"\\]|\\.){12,600})"|`((?:[^`\\$]|\\.){12,900})`)/g;
  let m;
  while ((m = re.exec(src))) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\\'/g, "'").replace(/\\n/g, ' ').trim();
    if (!/[a-z]{3}\s+[a-z]{2}/i.test(raw)) continue;
    if (/[<>{}]|https?:|\.tsx?$|^[a-z-]+:|className|px-|text-|bg-|flex |grid /i.test(raw)) continue;
    out.push(raw);
  }
  const text = src.replace(/\{[^{}]*\}/g, ' ');
  for (const t of text.match(/>[^<>{}]{20,600}</g) || []) {
    const v = t.slice(1, -1).replace(/\s+/g, ' ').trim();
    if (/[a-z]{3}\s+[a-z]{2}/i.test(v)) out.push(v);
  }
  return [...new Set(out)].filter((l) => l.length > 8 && !/^import\b/.test(l));
}

const chunks = [];
function addChunks(source, lines, limit = 1400) {
  let buf = [];
  let len = 0;
  let part = 1;
  const flush = () => {
    if (!buf.length) return;
    chunks.push({ source, section: `${source} (part ${part++})`, text: buf.join('\n') });
    buf = [];
    len = 0;
  };
  for (const l of lines) {
    if (len + l.length > limit) flush();
    buf.push(l);
    len += l.length + 1;
  }
  flush();
}

for (const [title, path] of PDFS) {
  addChunks(title, pdfLines(path));
}

const stepLines = [];
for (const path of STEP3_FILES) {
  let src = '';
  try {
    src = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  stepLines.push(...extractTsx(src));
}
addChunks('Pricing page step 3 (cover options)', [...new Set(stepLines)]);

writeFileSync(
  'supabase/functions/ai-sandbox-chat/site-knowledge.json',
  JSON.stringify(chunks, null, 0)
);
console.log(
  'chunks:',
  chunks.length,
  'chars:',
  chunks.reduce((a, c) => a + c.text.length, 0)
);
