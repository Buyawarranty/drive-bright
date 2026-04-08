

## Plan: Add "Remind Me" Button with Time Picker to Customers Tab

**Goal**: Add a CTA button to each customer row in the Customers tab that lets agents set reminders with date AND time, just like Apple Reminders. Also extend the existing reminder system to support customers.

### Changes

**1. `src/components/admin/leads/RemindMePopover.tsx`** — Enhance time selection
- Add a time input to ALL preset options (not just custom). When a user picks "Tomorrow", they can optionally adjust the time before confirming, like Apple Reminders.
- Add a quick-set time field below the preset buttons so users can type a specific time (e.g., "2:00 PM") before selecting a preset. The preset then uses that time instead of the default.
- Keep the existing custom calendar + time flow as-is for full date+time control.

**2. `src/hooks/useLeadReminders.tsx`** — Support `customer_` prefix
- In `fetchAllReminders`, add handling for IDs starting with `customer_` (alongside existing `cart_` prefix)
- Fetch customer data from the `customers` table and map `name`/`email`/`registration_plate` to the `lead` display shape
- Update `getPresetTime` to accept an optional time override so presets can use user-specified times

**3. `src/components/admin/CustomersTab.tsx`** — Add Remind Me button
- Import `RemindMePopover`
- Add `<RemindMePopover leadId={`customer_${customer.id}`} />` in the actions area of each customer row (next to the password reset button, around line 5129)
- Use the non-compact mode so it displays as a clear "Remind me" text button

**4. `src/components/admin/leads/MyRemindersPanel.tsx`** — Show customer reminders
- Ensure reminders with `customer_` prefix display correctly with the customer's name and a "Customer" label to distinguish from lead reminders

### Technical Detail: Time Selection UX
The enhanced flow will work like this:
1. User clicks "Remind me" button
2. Popover shows a time input at the top (defaulting to current preset times)
3. User can type any time (e.g., "14:00" / "2:00 PM")
4. Then select a preset date — the reminder uses their chosen time on that date
5. Or select "Pick date & time" for full calendar control

No database changes needed — the existing `lead_reminders` table handles `customer_`-prefixed IDs the same way it handles `cart_`-prefixed ones.

