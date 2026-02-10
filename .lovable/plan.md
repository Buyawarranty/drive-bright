
# Fix: Percentage Split Validation (Must Total 100%)

## Problem
The Percentage Split mode allows saving any value per agent without checking the total. As shown in the screenshot, one agent has 97% and another has 30% -- totaling 127%, which is impossible. There is no validation preventing this.

## Solution
Add real-time total tracking and validation so that:
1. A live "Total: X%" indicator shows the current sum of all agent percentages
2. The total turns red when it exceeds 100% or shows a warning when under 100%
3. The Save button is **disabled** if saving would cause the total to exceed 100%
4. A toast error explains the issue if a user tries to save an invalid value

## Changes (single file)

### `src/components/admin/leads/AgentsLeadsView.tsx`

1. **Add a computed `totalPercentage`** that sums all current agent percentages (using edited values where present, falling back to saved database values):
   - Loop through all `agentCaps`, for each agent use `editedPercentages[id] ?? cap.percentage ?? 0`
   - Display this total below the table header or above the agent list

2. **Add a "Total" row/indicator** below the percentage column showing something like:
   - "Total: 100%" in green when valid
   - "Total: 127%" in red when over 100
   - "Total: 70%" in amber when under 100

3. **Disable the Save button** when saving would make the total exceed 100%:
   - Calculate what the total would be if this agent's new percentage is saved
   - If total > 100, disable the save button and show a tooltip explaining why

4. **Validate on save** as a safety net:
   - In `handleSavePercentage`, compute the projected total
   - If it exceeds 100%, show a toast error and abort the save
   - Message: "Total percentage cannot exceed 100%. Currently at X%."

5. **Allow 0% entries** -- agents with 0% simply won't receive leads in percentage mode

## What stays unchanged
- No backend changes
- No changes to round robin mode, distribution logic, loading behavior, or any other functionality
- The `handlePercentageChange` input handler stays the same (still allows typing any value 0-100 per field for flexibility while editing)
