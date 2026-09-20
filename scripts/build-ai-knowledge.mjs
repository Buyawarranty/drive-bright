// Builds the approved-material knowledge base for the sandbox AI chatbot.
//
// SOURCE OF TRUTH (nothing else):
//   1. The latest Platinum Warranty Plan returned by Supabase
//   2. The latest Terms and Conditions returned by Supabase
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

// PLAN_PDF / TERMS_PDF remain available for controlled local rebuilds. Without
// overrides, resolve the current documents from Supabase so a rebuild cannot
// silently return Miles to an older bundled version.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mzlpuxzwyrcyrgrongeb.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

function versionFromUrl(url, fallback) {
  const match = url.match(/v(\d+)[-_](\d+)/i);
  return match ? `v${match[1]}.${match[2]}` : fallback;
}

function latestPolicyUrls() {
  if (!SUPABASE_KEY) throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is required to resolve current policy documents');
  const raw = execFileSync('curl', [
    '-sSfL', '-X', 'POST', `${SUPABASE_URL}/rest/v1/rpc/current_policy_pdf_urls`,
    '-H', `apikey: ${SUPABASE_KEY}`, '-H', `Authorization: Bearer ${SUPABASE_KEY}`,
    '-H', 'Content-Type: application/json', '-d', '{}',
  ], { encoding: 'utf8' });
  const value = JSON.parse(raw);
  if (Array.isArray(value) && value[0]?.terms_url && value[0]?.platinum_url) {
    return { termsUrl: value[0].terms_url, planUrl: value[0].platinum_url };
  }
  const composite = typeof value === 'string' ? value : value?.current_policy_pdf_urls;
  const urls = String(composite || '').replace(/^\(|\)$/g, '').split(',');
  if (urls.length !== 2 || !urls.every((url) => /^https:\/\//.test(url))) {
    throw new Error('Supabase did not return both current policy document URLs');
  }
  return { termsUrl: urls[0], planUrl: urls[1] };
}

const latest = process.env.PLAN_PDF && process.env.TERMS_PDF ? null : latestPolicyUrls();
const planVersion = latest ? versionFromUrl(latest.planUrl, 'latest') : 'local override';
const termsVersion = latest ? versionFromUrl(latest.termsUrl, 'latest') : 'local override';
const PDFS = [
  [`Platinum Warranty Plan ${planVersion}`, process.env.PLAN_PDF, latest?.planUrl],
  [`Terms and Conditions ${termsVersion}`, process.env.TERMS_PDF, latest?.termsUrl],
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

for (const [title, override, currentUrl] of PDFS) {
  let path = override;
  if (!path) {
    path = `/tmp/kb-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
    execFileSync('curl', ['-sSfL', '-o', path, currentUrl]);
  }
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

// Approved clarifications confirmed by management, retained unless contradicted
// by a newer document.
chunks.push({
  source: `Platinum Warranty Plan ${planVersion}`,
  section: `Platinum Warranty Plan ${planVersion} (replaced turbo and replaced hybrid battery clarification)`,
  text: [
    'Replaced turbo unit and replaced hybrid/EV drive battery — management-approved clarification.',
    'If the turbo unit has been replaced with a new or replacement unit, it remains covered even on an older or higher-mileage vehicle, provided a valid receipt and proof of purchase for the replacement part is supplied.',
    'If the hybrid or EV drive battery has been replaced, it remains covered on the same basis, provided a valid receipt and proof of purchase is supplied.',
    "The turbo age/mileage limit (7 years or 80,000 miles) and the drive battery limit (10 years or 80,000 miles) are measured from the replacement part, not from the vehicle's original registration date or lifetime mileage. In other words, the duration of cover for that component starts again from the date the replacement part was fitted, as evidenced by the receipt and proof of purchase.",
    'Normal exclusions still apply to the rest of the plan, and each claim is assessed when it is made.',
  ].join('\n'),
});



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
