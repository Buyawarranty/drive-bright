

## Plan: Reminder Due Popup Notifications

**Problem**: When a reminder becomes due, nothing happens — agents must manually check the reminders panel. The request is for an automatic popup when a reminder is due, which is clickable to navigate to that lead/customer, and dismissible with an X button.

### Changes

**1. New component: `src/components/admin/leads/ReminderDuePopup.tsx`**
- A fixed-position notification bar/toast that appears at the top of the dashboard when any reminder is overdue or due now
- Polls the `lead_reminders` table every 60 seconds for reminders where `reminder_time <= now` and `status = 'pending'`
- Displays: lead/customer name, the reminder label/note, and time it was due
- **Clickable**: clicking the notification navigates to the New Leads tab and highlights/scrolls to that lead (or Customers tab for customer reminders)
- **Dismissible**: X button on each notification calls `dismissReminder` or `completeReminder`
- Stacks multiple due reminders vertically if more than one is due
- Styled as a prominent banner (e.g., amber/orange background for due, red for overdue) — persistent until dismissed, not auto-fading like toasts

**2. File: `src/hooks/useLeadReminders.tsx`**
- Add a new hook or extend existing: `useDueReminders()` — fetches only reminders where `reminder_time <= now` and status is `pending` or `snoozed` with `snoozed_until <= now`
- Polls every 60 seconds using `setInterval`
- Returns the list of due reminders with lead data attached

**3. File: `src/components/admin/leads/NewLeadsTab.tsx` or parent dashboard component**
- Mount `<ReminderDuePopup />` at the top of the dashboard layout
- Pass `onNavigateToLead` callback that switches to the correct tab and scrolls/highlights the lead row

### UX Flow
1. Agent is working in the dashboard
2. A reminder becomes due at 2:00 PM
3. Within 60 seconds, a popup banner slides in at the top: "Reminder: Call Christopher Lyons — due 2:00 PM" with an X button
4. Agent clicks the banner → navigates to that lead in the New Leads list
5. Or agent clicks X → reminder is marked complete/dismissed and banner disappears

### Technical Details
- Fixed positioning (`fixed top-4 right-4 z-50`) so it's visible regardless of scroll
- Uses existing `useLeadReminders` infrastructure (same data fetching, same dismiss/complete functions)
- No database changes needed — uses existing `lead_reminders` table and status fields

