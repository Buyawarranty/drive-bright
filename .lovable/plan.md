

# Dealer Portal — Implementation Plan

This is a large feature adding a complete dealer-facing sub-application under `/dealer-portal/`. It reuses the existing admin dashboard layout, components, and styling.

## Scope

**Phase 1 (this implementation):**
- Marketing homepage at `/dealer-portal/`
- Dealer auth (signup + login) at `/dealer-portal/signup` and `/dealer-portal/login`
- Dashboard at `/dealer-portal/dashboard`
- Create Quote at `/dealer-portal/quotes/create`
- Quotes List at `/dealer-portal/quotes`
- Warranties List at `/dealer-portal/warranties`
- Dealer-specific sidebar navigation
- 3 new Supabase tables (`dealers`, `dealer_quotes`, `dealer_warranties`) with RLS

**Phase 2 (structure only):**
- Placeholder routes for `/dealer-portal/about`, `/dealer-portal/contact-us`, `/dealer-portal/digital-marketing-pack`, `/dealer-portal/digital-content`

---

## Database (Supabase Migration)

Three tables, all with RLS enforcing dealer-only access via `auth.uid()`:

1. **`dealers`** — `id (uuid, FK auth.users)`, `name`, `email`, `phone`, `company_name`, `created_at`. Auto-created on signup via trigger.
2. **`dealer_quotes`** — `id`, `dealer_id (FK dealers)`, `customer_name`, `vehicle_reg`, `vehicle_make`, `vehicle_model`, `mileage`, `warranty_duration`, `plan_type`, `price`, `status (pending/converted)`, `created_at`.
3. **`dealer_warranties`** — `id`, `quote_id (FK dealer_quotes)`, `dealer_id`, `customer_name`, `vehicle_reg`, `start_date`, `end_date`, `status (active/expired/cancelled)`, `created_at`.

RLS policies: dealers see only rows where `dealer_id = auth.uid()`.

---

## New Files

### Pages (`src/pages/dealer-portal/`)
| File | Purpose |
|------|---------|
| `DealerHome.tsx` | Marketing landing page (BuyAWarranty homepage style — hero, benefits, how it works, CTA) |
| `DealerSignup.tsx` | Fast signup form (name, email, phone, company, password) |
| `DealerLogin.tsx` | Email + password login, forgot password link |
| `DealerDashboard.tsx` | Admin-layout dashboard with sidebar, stats cards, recent quotes table, quick actions |
| `DealerCreateQuote.tsx` | Quote creation form using existing Card/Input/Select components |
| `DealerQuotesList.tsx` | Table of quotes with search/filter |
| `DealerWarrantiesList.tsx` | Table of active warranties |

### Components (`src/components/dealer/`)
| File | Purpose |
|------|---------|
| `DealerSidebar.tsx` | Simplified sidebar (Dashboard, Create Quote, Quotes, Warranties, Logout) — mirrors AdminSidebar structure |
| `DealerLayout.tsx` | Wraps authenticated dealer pages with header + sidebar + main content area, reusing the same `bg-gray-50`, header bar, and flex layout from AdminDashboard |
| `DealerStatsCards.tsx` | Total Quotes / Active Warranties / Conversion Rate cards |
| `DealerRecentQuotes.tsx` | Recent quotes table component |

### Hooks (`src/hooks/`)
| File | Purpose |
|------|---------|
| `useDealerAuth.tsx` | Dealer-specific auth hook — checks `dealers` table membership, handles redirect |

---

## Routing (App.tsx additions)

```text
/dealer-portal/          → DealerHome (public marketing page)
/dealer-portal/signup    → DealerSignup (public)
/dealer-portal/login     → DealerLogin (public)
/dealer-portal/dashboard → DealerDashboard (protected)
/dealer-portal/quotes/create → DealerCreateQuote (protected)
/dealer-portal/quotes    → DealerQuotesList (protected)
/dealer-portal/warranties → DealerWarrantiesList (protected)
```

Footer and StickyNavigation will be hidden on `/dealer-portal/dashboard` and other authenticated dealer routes (same pattern as admin).

---

## Design Rules Applied

- **Homepage**: Reuses BuyAWarranty homepage section patterns (hero with orange CTA buttons, benefits grid, 3-step how-it-works, testimonial style)
- **Authenticated pages**: Same layout as `AdminDashboardInner` — white header bar with logo, sidebar on left (`lg:w-64`), `bg-gray-50` content area, orange-600 active states
- **Components**: Existing `Card`, `Table`, `Button`, `Input`, `Select`, `Sheet` from `src/components/ui/`
- **No new styling system** — all Tailwind classes match existing dashboard patterns

---

## Technical Details

- Dealer auth uses Supabase `auth.signUp` / `auth.signInWithPassword` with a post-signup trigger creating the `dealers` row
- Protected routes check for active session + `dealers` table membership
- Quote price field is numeric input (mock for now, API-ready structure)
- Status transitions: quote `pending` → `converted` creates a warranty row
- All tables use `uuid` primary keys with `gen_random_uuid()` defaults

