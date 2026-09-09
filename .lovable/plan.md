# Hyper-focused CRM feedback redesign

## Goal
Make the daily survey fast for sales agents and make team problems immediately visible to managers, using the selected focused blue-and-orange direction.

## Agent view
- Keep the exact Orders, New Leads, rating and comment questions.
- Turn issue choices into compact, high-contrast one-tap controls with clear selected states.
- Show simple completion progress and keep the submit action prominent.
- Use a focused single-column flow that works well in the daily pop-up and the agent’s own feedback page.
- Keep agents limited to their own answers and trends.

## Manager view
- Lead with today’s completion, average CRM rating, and reported-problem count.
- Make missing responses and urgent issues visually distinct without adding noise.
- Keep rating trends, problems by agent, expandable answers, date ranges and CSV export.
- Reorganise the page into one clear vertical path: daily status, trends, agents, then detailed history.

## Visual system
- Apply the selected confident palette through semantic theme tokens: deep blue structure, bright blue actions, orange attention, and a bright neutral surface.
- Use Sora for headings and Manrope for body text on these views.
- Use restrained transitions for selections, progress and expanded answers.
- Preserve existing dashboard components, accessibility and dark-mode behaviour.

## Validation
- Check both role-specific render paths and confirm no survey or reporting behaviour changed.
- Run the relevant type checks.
- Verify the accessible public/auth-free portions available in the preview; authenticated end-to-end checks are unavailable for this external Supabase project.
