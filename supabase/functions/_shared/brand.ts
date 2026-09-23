// Shared brand definitions for all outgoing email / messaging functions.
//
// One Supabase backend serves two separate businesses:
//   - Buy A Warranty  (buyawarranty.co.uk)
//   - Panda Protect   (pandaprotect.co.uk)
//
// Every email must use the branding, sender address and links of the site the
// person is actually using. Never mix the two.

export type BrandKey = "buyawarranty" | "pandaprotect";

export interface Brand {
  key: BrandKey;
  /** Human readable brand name used in copy and subject lines */
  name: string;
  /** Legal / footer entity line */
  legalName: string;
  /** Bare domain, e.g. buyawarranty.co.uk */
  domain: string;
  /** Full site url, no trailing slash */
  siteUrl: string;
  /** Absolute logo url for email headers */
  logoUrl: string;
  /** Trustpilot review page */
  trustpilotUrl: string;
  /** Primary accent colour used on buttons */
  accentColor: string;
  supportEmail: string;
  claimsEmail: string;
  noReplyEmail: string;
  quotesEmail: string;
  infoEmail: string;
  helloEmail: string;
  notificationsEmail: string;
  marketingEmail: string;
  quotePhone: string;
  claimsPhone: string;
}

export const BRANDS: Record<BrandKey, Brand> = {
  buyawarranty: {
    key: "buyawarranty",
    name: "Buy A Warranty",
    legalName: "Buy A Warranty is a trading name of Buy A Warranty Ltd.",
    domain: "buyawarranty.co.uk",
    siteUrl: "https://www.buyawarranty.co.uk",
    logoUrl: "https://www.buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png",
    trustpilotUrl: "https://uk.trustpilot.com/review/buyawarranty.co.uk",
    accentColor: "#eb4b00",
    supportEmail: "support@buyawarranty.co.uk",
    claimsEmail: "claims@buyawarranty.co.uk",
    noReplyEmail: "noreply@buyawarranty.co.uk",
    quotesEmail: "quotes@buyawarranty.co.uk",
    infoEmail: "info@buyawarranty.co.uk",
    helloEmail: "hello@buyawarranty.co.uk",
    notificationsEmail: "notifications@buyawarranty.co.uk",
    marketingEmail: "marketing@buyawarranty.co.uk",
    quotePhone: "0330 229 5045",
    claimsPhone: "0330 229 5045",
  },
  pandaprotect: {
    key: "pandaprotect",
    name: "Panda Protect",
    legalName: "Panda Protect is a trading name of Panda Protect Limited.",
    domain: "pandaprotect.co.uk",
    siteUrl: "https://www.pandaprotect.co.uk",
    logoUrl: "https://www.pandaprotect.co.uk/panda-protect-logo.png",
    trustpilotUrl: "https://uk.trustpilot.com/review/pandaprotect.co.uk",
    accentColor: "#EC6F33",
    supportEmail: "support@pandaprotect.co.uk",
    claimsEmail: "claims@pandaprotect.co.uk",
    noReplyEmail: "noreply@pandaprotect.co.uk",
    quotesEmail: "quotes@pandaprotect.co.uk",
    infoEmail: "info@pandaprotect.co.uk",
    helloEmail: "hello@pandaprotect.co.uk",
    notificationsEmail: "notifications@pandaprotect.co.uk",
    marketingEmail: "marketing@pandaprotect.co.uk",
    quotePhone: "0330 912 2535",
    claimsPhone: "0330 229 5045",
  },
};

export const DEFAULT_BRAND: BrandKey = "buyawarranty";

/** Normalise anything (a domain, url, key or record value) to a brand key. */
export function brandKeyFrom(value: unknown): BrandKey | null {
  if (!value || typeof value !== "string") return null;
  const v = value.toLowerCase();
  if (v.includes("pandaprotect") || v === "panda" || v === "panda protect") {
    return "pandaprotect";
  }
  if (v.includes("buyawarranty") || v === "baw" || v === "buy a warranty") {
    return "buyawarranty";
  }
  return null;
}

export interface BrandHints {
  /** Explicit brand passed in the request body */
  brand?: unknown;
  /** Brand stored on a customer / quote / claim record */
  record?: { brand?: unknown } | null;
  /** Any url known to belong to the originating site */
  url?: unknown;
  /** Force a brand (e.g. dealer portal functions) */
  force?: BrandKey;
  /** Override the default when nothing else is known */
  fallback?: BrandKey;
}

/**
 * Resolve which brand an email should be sent as.
 *
 * Order of precedence:
 *   1. forced brand (dealer-portal only functions)
 *   2. explicit brand in the request body
 *   3. the website the request came from (Origin / Referer header)
 *   4. the brand stored on the customer / quote / claim record
 *   5. any known url
 *   6. default brand
 */
export function resolveBrand(req?: Request | null, hints: BrandHints = {}): Brand {
  if (hints.force) return BRANDS[hints.force];

  const fromBody = brandKeyFrom(hints.brand);
  if (fromBody) return BRANDS[fromBody];

  if (req) {
    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    const fromOrigin = brandKeyFrom(origin);
    if (fromOrigin) return BRANDS[fromOrigin];
  }

  const fromRecord = brandKeyFrom(hints.record?.brand);
  if (fromRecord) return BRANDS[fromRecord];

  const fromUrl = brandKeyFrom(hints.url);
  if (fromUrl) return BRANDS[fromUrl];

  return BRANDS[hints.fallback ?? DEFAULT_BRAND];
}

/** Build a Resend "from" header for a brand, e.g. brandFrom(brand, "Customer Care", "noreply") */
export function brandFrom(brand: Brand, label: string, mailbox: string): string {
  const name = label ? `${brand.name} ${label}` : brand.name;
  return `${name} <${mailbox}@${brand.domain}>`;
}
