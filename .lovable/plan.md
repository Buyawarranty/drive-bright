# CRM at departure

## What you will see
Inside **Leaver archives**, each person gets an **Open saved CRM** action. It opens a read-only departure record with:
- Their name, departure time, who disabled/removed them, and their permissions at that time.
- Their last recorded CRM page and supported saved filters, with the time that view was recorded.
- Their assigned leads and the customers they were allowed to see at departure, with archived details rather than today's changing records.
- Their available login/attendance and lead-opening history, with dated source references and UK/UTC times.

The saved view cannot call, message, edit, reassign, take payments or reactivate the account. Existing JSON downloads remain available.

## Capture and safeguards
- Capture the departure state automatically before disabling, blocking, archiving or removing an account changes its permissions or ownership. Cover every existing departure entry point.
- Keep the departure state separate from the larger history archive, so its meaning does not depend on when someone presses **Finish archive**.
- Preserve each departure event independently when a person is later reactivated and leaves again.
- Record supported page/filter changes going forward using a narrowly allowlisted, authenticated record. Never copy browser storage, passwords, tokens, arbitrary URLs or unsent form text.
- Mark old archives **Departure view unavailable** unless suitable historical records exist. Any reconstruction is clearly labelled and never presented as the original screen.
- Access is admin/super-admin only, enforced on the server as well as in the menu. Viewing the archive never signs in as the former staff member.

## Technical approach
- Extend the existing leaver archive with immutable departure metadata and paginated snapshot items. Use explicit table grants, RLS and protected server functions; exclude new archive tables from generic recursive source discovery.
- Capture permissions and server-authorised record visibility using the pre-departure identity and timestamp. Preserve the sales/sales-lead two-month customer boundary and any then-valid 24-hour approval; ownership alone is not proof of visibility.
- Order capture ahead of existing offboarding/unassignment triggers and verify deletion paths that reassign before deleting. Use bounded indexed operations and rollback-safe capture so a failed snapshot cannot silently claim completeness or repeat the deactivation timeout.
- Keep browser-reported view observations distinct from server-verified permissions and ownership. Store observed and captured timestamps separately and identify the latest recorded browser session without claiming it represents every computer.
- Render a dedicated archival viewer from frozen data only, not live CRM screens or impersonation. Add truthful loading, unavailable, partial and failure states; prevent partial failed downloads being described as complete.
- Update the existing archive description to say **recorded activity**, rather than imply every possible click was captured.

## Verification
- Tests for pre-reassignment capture, frozen values after live edits, repeated departures, all departure entry points, missing/partial capture and retry safety.
- Server checks for admin/super-admin access, refusal for other roles, authenticated self-only view recording, sanitisation and immutable records.
- Concrete customer-visibility tests for the two-month boundary and 24-hour approval expiry.
- Browser checks of archive opening, pagination, recorded timestamps and absence of live actions using clearly isolated test records. Do not disable a real employee for testing.
- Real authenticated end-to-end verification is currently unavailable for this externally managed Supabase project; report that limitation separately from fixture and database tests.

## Limits and release
This preserves a readable data-based departure view, not a pixel-perfect screenshot or video of everything they saw. Logs identify an account, not conclusively the physical person using it. Missing past activity cannot be recovered, and court acceptance is not guaranteed.

No website publication is included. Database changes use the connected external Supabase system and its approval process; they are not isolated merely because the website changes remain in preview. A court PDF evidence pack is a separate task.