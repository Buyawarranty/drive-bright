# Monthly revenue goals in Analytics

## What will change
- Add one company-wide revenue goal for each calendar month.
- Let only `admin` and `super_admin` set or update the selected month’s goal from the Revenue & AOV chart area.
- Show the goal as a clear outlined target level over each monthly revenue bar.
- Add the achieved percentage to the chart tooltip, alongside revenue, average order value and warranties sold.
- Show the month’s goal, amount achieved and amount remaining near the chart, with a confirmation step before saving changes.

## Data and access
- Store goals by month so previous targets remain attached to their original bars.
- Everyone who already has Analytics access can see goals and progress.
- Database access will enforce that only admins and super admins can create or change goals.
- Revenue will use the chart’s existing collected-revenue calculation, so pending money is not counted early.

## Technical details
- Add a small `monthly_revenue_targets` table keyed by month, with the target amount and who last updated it.
- Add authenticated read access and admin/super-admin write policies.
- Extend the existing Recharts monthly revenue data with `target` and `percentageAchieved` values, using a transparent outlined bar behind/over the solid revenue bar.
- Keep the existing source filters and monthly revenue logic unchanged.

## Verification
- Check an admin can set and revise a target, while another role cannot see the editing control.
- Confirm the target outline, percentage and tooltip display correctly above and below 100%.
- Confirm pending payments remain excluded from achieved revenue.
- Check the chart at desktop and mobile widths and verify the preview has no errors.
