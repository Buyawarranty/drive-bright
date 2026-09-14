# Make the best pricing model unmistakable

## Changes
- Give the best-converting model a prominent green full-width treatment and a clear “Best converting — recommended” heading.
- Give the live model a distinct orange treatment and explicitly state when it is performing below the best model.
- Replace ambiguous percentage tags with plain comparisons, including the best model’s name and the sales-per-day figures.
- Keep price movement separate from conversion performance so the two measures cannot be confused.
- Preserve all pricing, publishing, reverting, notes, and reporting behaviour.

## Technical details
- Update only the price update log presentation in `PriceUpdateLogPanel.tsx`.
- Reuse existing semantic colours and existing button/card components.
- Verify the affected screen still renders and the project checks pass.
