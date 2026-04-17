

## Plan: Refactor Step 3 Sticky Bar UI

**File:** `src/components/PricingTable.tsx` (lines 2741–2947 only)

**Scope:** Pure visual/layout refactor of the sticky summary bar. No changes to pricing logic, calculations, handlers, props, or navigation. All `displayMonthlyPrice`, `stripeSavings`, `payInFullDiscounted`, `handleSelectPlan`, `paymentType` logic stays identical.

### Problems with current desktop layout
1. All 5 sections use `flex-1` → equal width forces price (key info) into the same narrow column as the trust badge, making it feel cramped.
2. `divide-x` lines + `flex-1` cause uneven visual weight; CTA button is squeezed.
3. Padding inside sections (`px-5`) is fine but proportions are wrong.
4. Trust block is centered horizontally with shield + text, when reference shows it more compactly left-aligned.

### Target proportions (desktop, left → right)
Use weighted flex (instead of equal `flex-1`) to give price + CTA more room:

```text
┌──────────┬───────────┬─────────────┬──────────────┬────────────────┐
│  TRUST   │  COVER    │   PRICE     │  PAY IN FULL │      CTA       │
│  ~14%    │   ~20%    │    ~22%     │     ~22%     │     ~22%       │
│ flex:none│  flex:1   │   flex:1.2  │   flex:1.2   │  flex:1.3      │
└──────────┴───────────┴─────────────┴──────────────┴────────────────┘
   24px gap between sections, vertical divider lines, py-3.5 px-5
```

### Specific changes per section

1. **Container** — keep `divide-x divide-gray-200`, add `gap-0`, increase vertical padding to `py-3.5`, ensure `items-stretch` for full-height dividers.

2. **Trust (Section 1)** — `flex-shrink-0` (no flex-1), tighten to ~180px width, left-align content, smaller shield circle (w-8 h-8), keep "Excellent / stars / 4.8 out of 5" stack.

3. **Cover (Section 2)** — `flex-1`, left-aligned, label uppercase orange, title `text-base font-bold`, subtext with wrench icon `text-xs text-gray-600`. Add `mt-1` between rows for breathing room.

4. **Price (Section 3)** — wider via `flex-[1.2]`. Stack: `text-3xl` daily price (was `text-2xl`), `text-xs` monthly line, `text-xs text-green-600` savings line. Add `gap-1` between lines for clear vertical rhythm.

5. **Pay in Full (Section 4)** — `flex-[1.2]`, center pill horizontally, slightly larger pill (`px-4 py-2.5`, `rounded-xl`), wallet icon `w-5 h-5`, two-line text stays.

6. **CTA (Section 5)** — `flex-[1.3]` so button has room, button stays `w-full` inside, add `gap-1.5` for "Secure checkout" subtext below button. Keep lock icon + text.

### Mobile (lines 2790–2843)
Already stacks vertically and works — only minor tweak: increase gap between price row and CTA from `gap-2` to `gap-3` for breathing room, and ensure the "Pay in full" pill doesn't overlap the daily price by giving the price column `min-w-0 flex-1` and the pill `flex-shrink-0`. No structural changes.

### What stays untouched
- All IIFE calculation blocks (`months`, `totalContract`, `payInFull`, `stripeSavings`, `payInFullDiscounted`, `pencePerDayRaw`, `dailyPriceLabel`, `coverLabel`)
- `handleSelectPlan`, `plansLoading`, `plansError`, `retryFetchPlans`
- Loading and error states
- Outer fixed positioning, `bg-gray-50 border-t-2 border-green-200`, z-index
- Bottom padding spacer (line 2739)
- "What's included" reassurance banner above

### Risk
Zero functional risk — only Tailwind class changes inside the existing JSX structure. Section numbering and order preserved so visual hierarchy remains predictable for users mid-funnel.

