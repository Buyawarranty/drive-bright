// Shared resolver so every email always attaches the newest Terms & Conditions
// and Platinum Warranty Plan uploaded in the admin dashboard.

const FALLBACK = {
  termsUrl:
    'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/terms/terms-and-conditions-v3.4-2026-06-02.pdf',
  termsName: 'Terms-and-Conditions.pdf',
  platinumUrl:
    'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/platinum-warranty-plan-v3.4-2026-06-02.pdf',
  platinumName: 'Platinum-Warranty-Plan.pdf',
};

const toFilename = (name: string | null, fallback: string) => {
  if (!name) return fallback;
  const safe = name.trim().replace(/[^a-zA-Z0-9.\-_ ]/g, '').replace(/\s+/g, '-');
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
};

export async function getLatestPolicyDocs() {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://mzlpuxzwyrcyrgrongeb.supabase.co';
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const res = await fetch(
      `${supabaseUrl}/rest/v1/customer_documents?select=plan_type,file_url,document_name,created_at&plan_type=in.(terms-and-conditions,platinum)&order=created_at.desc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return FALLBACK;
    const rows = await res.json();
    const terms = rows.find((r: any) => r.plan_type === 'terms-and-conditions');
    const platinum = rows.find((r: any) => r.plan_type === 'platinum');
    return {
      termsUrl: terms?.file_url || FALLBACK.termsUrl,
      termsName: toFilename(terms?.document_name, FALLBACK.termsName),
      platinumUrl: platinum?.file_url || FALLBACK.platinumUrl,
      platinumName: toFilename(platinum?.document_name, FALLBACK.platinumName),
    };
  } catch (_e) {
    return FALLBACK;
  }
}
