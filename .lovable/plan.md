# Align Renewals with New Leads

## Goal
Make the Renewals queue use the same desktop column order and widths as New Leads, so a renewal keeps a familiar position when it enters the New Leads list.

## Changes
- Match the New Leads sequence: number, selection, agent, status, calls, actions, name, phone, WhatsApp, email, registration, payment, paid date, agent activity, lead date, customer activity, and time to contact.
- Add the missing WhatsApp column and a direct WhatsApp action for each renewal with a valid phone number.
- Reduce the oversized Renewals Actions column to the New Leads width while keeping all existing renewal actions available.
- Keep renewal-specific content intact: renewal outcome remains the status, policy expiry remains time to contact, and previous-warranty details stay under payment.
- Preserve all renewal assignment, filtering, syncing, and New Leads flow behaviour.

## Verification
- Check the Renewals queue at desktop width and compare its headings and row alignment with New Leads.
- Confirm horizontal scrolling, action controls, and WhatsApp links work without clipped or overlapping text.
- Confirm the preview has no build or runtime errors.

## Technical details
This is a presentation-only change in the existing Renewals queue table. No database, assignment, pricing, or renewal timing logic will change.
