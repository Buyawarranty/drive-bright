

## Goal
Update only the hero section of `DealerHome.tsx` to add a UK reg input + smart CTA. Logged-out → "Sign in / Sign up to continue" (preserves reg via localStorage, redirects back). Logged-in → "Get Quote" (routes to dealer quote flow with reg pre-filled). Dark theme + layout untouched.

## Scope clarification
The brief mentions a full dealer quote flow (`/dealer/quote`, `/dealer/pricing`, `/dealer/checkout`, dealer pricing logic). That's a large separate build. The existing dealer portal already has `/dealer-portal/quotes/create` (a single-form quote page, not a multi-step flow with pricing/checkout).

**This plan only covers the hero-section update + plumbing the reg into the existing dealer quote create page.** The full multi-step `/dealer/quote → /pricing → /checkout` isolated journey with dealer-specific pricing is a follow-up build I'll flag at the end.

## Changes

### 1. New component: `src/components/dealer/DealerRegHero.tsx`
- UK reg-plate styled input (matches existing yellow plate look in current hero — reuse the blue UK / yellow plate visual)
- Validation: empty → "Enter registration number"; invalid UK format → "Enter valid UK registration" (regex: standard UK plate patterns)
- Autofocus on mount; Enter key submits
- Reads `useDealerAuth()` for `dealer` + `loading`
- Logic on submit:
  - **Logged out**: save reg to `localStorage` key `dealerPendingReg`, navigate to `/dealer-portal/login?redirect=/dealer-portal&reg=<plate>`
  - **Logged in**: navigate to `/dealer-portal/quotes/create?reg=<plate>`
- CTA label switches based on auth state ("Sign in / Sign up to continue" vs "Get Quote")
- Shows skeleton/disabled state while `loading`

### 2. `src/pages/dealer-portal/DealerHome.tsx`
- Replace the existing reg-plate "Start Selling →" block + the two buttons below it with `<DealerRegHero />`
- Keep everything else (heading, benefits checklist, trust block, hero image, vehicle types, all sections below) **identical**

### 3. `src/pages/dealer-portal/DealerLogin.tsx`
- After successful login + dealer check, read `?redirect=` and `?reg=` query params (or `localStorage.dealerPendingReg`)
- If redirect param present → navigate there preserving `?reg=`; else default to `/dealer-portal/dashboard`
- Existing "no dealer account" guard unchanged

### 4. `src/pages/dealer-portal/DealerSignup.tsx`
- Same redirect-back logic post-signup so the "Sign up" path also returns to hero with reg preserved

### 5. `src/pages/dealer-portal/DealerCreateQuote.tsx`
- On mount, read `?reg=` from URL and pre-fill `form.vehicle_reg` (uppercase)
- Clear `localStorage.dealerPendingReg` once consumed
- No other changes — keeps existing single-form quote flow working

## UX details
- Reg input: same yellow-plate visual as current hero (keeps brand consistency)
- CTA: full-width orange `bg-orange-500 hover:bg-orange-600`, rounded, h-14
- Inline error text in red below input (no toast for validation)
- Loading spinner inside CTA during auth-state hydration
- On logout (handled by existing `useDealerAuth.signOut`), hero auto-reverts to logged-out CTA via reactive `dealer` state

## Out of scope (flagged for follow-up)
- Multi-step `/dealer/quote → /dealer/pricing → /dealer/checkout` isolated journey
- Dealer-specific pricing engine, margins, custom discounts
- `dealerJourney` session key / `DealerJourneyRouter`

These would be a substantial separate build. Current plan routes "Get Quote" into the existing `/dealer-portal/quotes/create` form, which already works and is dealer-isolated. Once you confirm, I can scope the full isolated multi-step flow as a follow-up.

## Files touched
- `src/components/dealer/DealerRegHero.tsx` (new)
- `src/pages/dealer-portal/DealerHome.tsx` (hero block only)
- `src/pages/dealer-portal/DealerLogin.tsx` (post-login redirect)
- `src/pages/dealer-portal/DealerSignup.tsx` (post-signup redirect)
- `src/pages/dealer-portal/DealerCreateQuote.tsx` (read `?reg=` on mount)

