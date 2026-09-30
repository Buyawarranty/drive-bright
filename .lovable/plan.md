# Standardise Quotes & Orders duration pricing

## What will change
- Give all 1-, 2-, and 3-year duration tiles the same fixed layout:
  - `1-Year Cover`
  - `£47/mo · 12 instalments`
  - `£564 total · £564/yr`
- Apply the same labels and line order to every duration so agents can compare them immediately.
- Keep optional badges such as “Popular”, “Best value”, savings, and Pay Yearly availability below the three core price lines.
- Ensure the monthly amount, total, and yearly equivalent on each tile are all calculated from that tile’s same 12-instalment schedule.
- Ensure the selected 2- or 3-year tile uses exactly the same figures as the payment choice and bottom price summary, including custom prices.

## Technical details
- Update only the duration-card display and its shared price derivation in Quotes & Orders.
- Keep BAW PayLater as a separate payment choice; its yearly collection amount will not replace or alter the standard comparison figures at the top of the duration tile.
- Preserve existing minimum prices, 30% discount controls, commission rules, and PayLater collection rules.
- Verify all three durations in the preview and confirm the project builds successfully.
