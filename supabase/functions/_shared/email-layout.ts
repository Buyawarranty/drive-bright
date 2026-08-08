// Shared mobile-first email layout helpers.
// Email clients ignore external CSS, so we ship one <style> block with
// media queries plus class hooks that every marketing template can use.

/**
 * Responsive rules for marketing emails.
 * Inject inside <head> (or immediately before the body markup for
 * fragment-style templates — Gmail/Apple Mail both honour it).
 *
 * Class hooks:
 *  - .baw-wrap    outer 600px container -> full width + 16px side padding on mobile
 *  - .baw-pad     inner content padding -> 20px on mobile
 *  - .baw-pad-sm  tighter padding -> 16px on mobile
 *  - .baw-stack   table cell -> full-width block (stacks contact links, columns)
 *  - .baw-hide-sm hide on mobile (decorative icons)
 *  - .baw-btn     CTA -> full width, comfortable tap target
 *  - .baw-h1/.baw-text  scaled type
 */
export const EMAIL_RESPONSIVE_STYLE = `
  <style>
    body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; }
    img { border: 0; outline: none; text-decoration: none; }
    a { word-break: break-word; }
    .baw-only-sm { display: none !important; }
    @media only screen and (max-width: 620px) {
      .baw-wrap { width: 100% !important; max-width: 100% !important; }
      .baw-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .baw-pad-sm { padding-left: 16px !important; padding-right: 16px !important; }
      .baw-pad-y { padding-top: 24px !important; padding-bottom: 24px !important; }
      .baw-stack {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        border-right: 0 !important;
        border-bottom: 1px solid #e6ebf1 !important;
        padding: 10px 0 !important;
        text-align: center !important;
      }
      .baw-stack:last-child { border-bottom: 0 !important; }
      .baw-hide-sm { display: none !important; }
      .baw-only-sm { display: block !important; }
      .baw-btn {
        display: block !important;
        width: auto !important;
        text-align: center !important;
        padding: 15px 18px !important;
        font-size: 17px !important;
      }
      .baw-h1 { font-size: 24px !important; line-height: 1.25 !important; }
      .baw-text { font-size: 16px !important; line-height: 1.55 !important; }
      .baw-grid-cell { display: block !important; width: 100% !important; padding: 8px 0 !important; }
    }
  </style>`;

/** Standard mobile-safe wrapper for fragment-style templates. */
export function wrapResponsiveEmail(inner: string): string {
  return `${EMAIL_RESPONSIVE_STYLE}
  <div style="background-color:#f5f7fb;padding:0;margin:0;">
    <div class="baw-wrap baw-pad" style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #ffffff;">
      ${inner}
    </div>
  </div>`;
}
