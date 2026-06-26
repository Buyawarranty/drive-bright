## Goal

Stop forcing a binary "all marketing or nothing" choice. Let people pick **how many** emails they want, so we keep more subscribers instead of losing them entirely.

## The three options customers will see

1. **All updates** - renewal offers, member discounts, news, tips. (Default - no change for existing subscribers.)
2. **Just the essentials** - only the important stuff: renewal reminders when their warranty is ending, and the occasional claims/policy tip. No promotions, no newsletters. Roughly 3-4 emails a year.
3. **Off** - no marketing at all. (Policy documents, claims updates and renewal paperwork still come through because those are service emails, not marketing.)

## Where the choice appears

**1. Unsubscribe page (the rescue moment)**
Today, clicking "unsubscribe" instantly removes them. After this change, the page will say:

> Before you go - would you like to hear from us less often instead?
> [ Just the essentials ]  [ No thanks, unsubscribe me fully ]

This is where we'll save most people.

**2. Customer dashboard - "Email preferences" section**
Logged-in customers get a small panel in My Account with the three radio options and a Save button. They can change their mind any time without hunting through old emails.

**3. Staff Unsubscribe tab (admin dashboard)**
When a customer phones in, staff will see a frequency selector next to the email box - so they can set someone to "Essentials only" instead of fully off when that's what the customer actually wants.

## How sends will respect it

The marketing sender will check the customer's frequency before each campaign:
- **All updates** -> send everything (today's behaviour).
- **Essentials only** -> only send if the campaign is tagged as "essential" (renewal-window reminders, policy/claims tips). Skip promos and newsletters.
- **Off** -> skip entirely (today's behaviour).

Each marketing campaign / template gets a simple "Is this essential?" toggle so the rule is unambiguous.

## Re-subscribe link

The existing one-click re-subscribe link will set them back to **All updates** by default, and the welcome-back page will offer "Actually, just the essentials please" so they can dial it down without re-unsubscribing.

## Technical notes

- New column `marketing_audience.frequency` with values `all` | `essentials` | `off`. Existing subscribed rows default to `all`; existing unsubscribed rows default to `off`. Backfilled automatically.
- New boolean `email_campaigns.is_essential` (default `false`).
- `send-marketing-email` edge function updated to filter recipients by frequency vs. campaign essentiality.
- `handle-email-unsubscribe` updated to render a 2-option page (essentials / fully off) before committing.
- `handle-email-resubscribe` updated to write `frequency = 'all'` and offer a "make it essentials" button on the confirmation page.
- New `EmailPreferences.tsx` panel added to the customer dashboard.
- Staff Unsubscribe tab gains a frequency radio group.
- No new tables; no breaking changes to existing data.

## What this does not change

- Service/transactional emails (policy docs, claims status, login security) are unaffected - they are not marketing and always send.
- Existing unsubscribed customers stay unsubscribed.
- Anyone currently subscribed stays on "All updates" until they choose otherwise.
