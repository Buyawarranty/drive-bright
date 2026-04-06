

# Lead Assignment Architecture & Bug Root Cause

## How Round-Robin Currently Works

```text
Customer visits website
        |
        v
  abandoned_carts UPSERT
        |
        v
  TRIGGER: auto_create_lead_from_abandoned_cart()
        |
        +---> 1. IDEMPOTENCY: Same cart_id already has a lead? UPDATE existing, STOP
        +---> 2. PHONE DEDUP: Same phone within 7 days? UPDATE existing, STOP
        +---> 3. EMAIL DEDUP: Same email within 7 days? UPDATE existing, STOP
        +---> 4. TERMINAL GUARD: Phone/email in converted/lost/fake? STOP
        +---> 5. NEW LEAD: get_next_sales_user() -> round-robin assign -> INSERT
        
  TRIGGER: protect_worked_lead_assignment()
        |
        +---> If lead has activity (status != 'new', calls > 0, notes exist)
              AND no auth.uid() (automated process), BLOCK reassignment
```

## What Happened With 07397214821 (Mohammad)

The database shows **5 separate lead rows** for this phone number:

| # | Created | Assigned To | Status | How Created |
|---|---------|------------|--------|-------------|
| 1 | Mar 19 | James | fake_lead | Original cart `632a5594` |
| 2 | Mar 30 | James | contacted | Cart `abf9baf9` — new lead (>7 days from #1) |
| 3 | Mar 30 | James | new | **DUPLICATE** of #2 (same cart timestamp) |
| 4 | Apr 1 | **Ash** | quote_sent | Cart `b3cedf98` — new email entry, phone dedup found #2 but then a Price Match callback cart `3388a11c` created ANOTHER lead |
| 5 | Apr 1 | **Ash** | quote_sent | Price Match callback cart with fake email `callback-...@price-match.temp` — bypassed email dedup |

### The Bug: Two Specific Gaps

**Gap 1 — Phone format mismatch**: The phone dedup uses `regexp_replace` to strip non-digits, but `07397214821` (11 digits) vs `+447397214821` (12 digits with country code) produce different strings (`07397214821` vs `447397214821`). The Price Match callback cart stored `+447397214821`, which **bypassed** the phone dedup check.

**Gap 2 — Fake callback email bypasses email dedup**: The Price Match system generates a temporary email like `callback-...@price-match.temp`. This doesn't match the real email `m.ummair90@gmail.com`, so the email dedup also fails. Combined with Gap 1, the system creates a brand new lead and round-robin assigns it to the next agent (Ash instead of James).

**Gap 3 — 7-day dedup window**: The dedup only looks back 7 days. Lead #1 (Mar 19, fake_lead) was already terminal, but if it hadn't been, it would still have fallen outside the window by Mar 30.

## The Fix (Database Migration)

### 1. Normalize UK phone numbers before dedup comparison
Add phone normalization that converts `+44` prefix to `0` (or vice versa) so `+447397214821` and `07397214821` match. Apply this in:
- `auto_create_lead_from_abandoned_cart()` — phone dedup step
- `recover_orphaned_leads()` — phone dedup step
- `protect_worked_lead_assignment()` — no change needed (doesn't do phone matching)

### 2. Cross-reference by phone regardless of email
When a callback or price-match cart has a fake/temp email, the function should still find the existing lead by phone. Add: if email contains `@price-match.temp` or `@callback.temp`, skip email dedup and rely solely on phone dedup (with normalized numbers).

### 3. Extend dedup window for worked leads
Currently dedup only looks back 7 days. Change to: if a matching lead has **any activity** (assigned, status changed, notes, calls), match it regardless of age. Only apply the 7-day window for untouched `new` status leads.

### 4. Clean up existing duplicates
Merge the duplicate rows for this customer, keeping the one with the most activity (James's `contacted` lead `bd195ed1`).

## Files Changed

- **1 database migration** — Updates `auto_create_lead_from_abandoned_cart()` and `recover_orphaned_leads()` with:
  - UK phone normalization helper (`normalize_uk_phone()`)
  - Temp-email detection to force phone-only dedup
  - Extended dedup window for worked leads (no time limit)
- **No frontend changes needed** — this is purely a database trigger logic fix

