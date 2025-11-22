# Hosting Setup Guide - WWW to Non-WWW Redirect

This project includes configurations for redirecting www to non-www versions of the domain.

## Automatic Configuration Files Included

### 1. For Netlify (Recommended for Lovable)
File: `public/_redirects`
- Automatically deployed with your site
- Handles 301 redirects from www to non-www
- Also includes trailing slash redirects

### 2. For Vercel
File: `public/vercel.json`
- Automatically used if deploying to Vercel
- Permanent (301) redirect from www to non-www

### 3. For Apache Servers
File: `public/.htaccess`
- For traditional Apache hosting
- Includes:
  - WWW to non-www redirect
  - Force HTTPS
  - Trailing slash redirects
  - SPA fallback routing
  - Browser caching
  - Compression

### 4. Client-Side Fallback
File: `src/utils/wwwRedirect.ts`
- Runs automatically on page load
- Redirects if server-side redirect fails
- Browser will cache the redirect

## Setup Instructions

### Option 1: Lovable Custom Domain Settings
1. Go to Project > Settings > Domains in Lovable
2. Add your custom domain: `buyawarranty.co.uk`
3. The `_redirects` file will automatically handle www redirects

### Option 2: External DNS/Hosting
If using external hosting or DNS:

#### Cloudflare (Recommended)
1. Log in to Cloudflare
2. Go to Rules > Page Rules
3. Create a new page rule:
   - URL pattern: `www.buyawarranty.co.uk/*`
   - Setting: Forwarding URL (301 Permanent Redirect)
   - Destination: `https://buyawarranty.co.uk/$1`

#### Direct DNS Configuration
1. Remove or don't create a CNAME/A record for `www`
2. Only point the apex domain (`@` or `buyawarranty.co.uk`) to your hosting
3. Visitors to www will get a DNS error or your host will redirect

## Verification

After setup, verify the redirect works:

```bash
# Test with curl
curl -I https://www.buyawarranty.co.uk

# Should show:
# HTTP/1.1 301 Moved Permanently
# Location: https://buyawarranty.co.uk/
```

Or visit https://www.buyawarranty.co.uk in your browser - it should redirect to https://buyawarranty.co.uk/

## SEO Benefits

✅ Prevents duplicate content issues
✅ Consolidates link equity to one domain
✅ Improves search engine rankings
✅ Ensures consistent branding

## Troubleshooting

**Redirect not working?**
1. Check your hosting platform
2. Ensure the appropriate config file is deployed
3. Clear browser cache and CDN cache
4. Verify DNS settings
5. Client-side fallback will catch any missed cases

**Still seeing www version?**
- The client-side redirect in `App.tsx` will handle it
- Check browser console for any errors
- Verify the domain is correctly configured in your hosting settings
