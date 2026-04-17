

## Diagnosis: cancellation worked correctly — this is by design

I checked the database. The customer record (`accepttest accepttest`, B11 CSD, signup 17/04/2026 20:00) now has `status = 'Cancelled'` and was last updated at 20:08:02 — exactly when you cancelled. **The cancellation succeeded.**

The reason it's still visible: cancelled customers are **intentionally kept in the Customer Management list** with a highlighted "Cancelled" status. The `CancelWarrantyDialog` itself even tells you this:

> "Customer will remain visible. Cancelled/refunded customers stay in the dashboard with highlighted status. Use **Archive** to hide them."

This matches the project's archiving standard — cancellations preserve audit history and commission/unwind tracking; **Archive** is the action that removes a row from the visible list (`is_deleted = true`).

### What you can do now

Three possible paths — pick one:

**Option A — Archive this specific record now (no code change)**
Open the row's actions menu and click **Archive**. The row will disappear from the list (it'll be soft-deleted like the 20+ older `buyawarranty1@gmail.com` test rows already in the DB).

**Option B — Add a "Hide cancelled" filter toggle (small UI change)**
Add a toggle/checkbox at the top of Customer Management called "Hide cancelled & refunded". When ON, the default `all` view filters out rows where `status` is `cancelled` or `refunded`. Off by default (preserves current behaviour and audit visibility). One-line filter addition in `CustomersTab.tsx` around line 715.

**Option C — Auto-archive on cancellation (changes documented behaviour)**
Modify `CancelWarrantyDialog.tsx` so cancelling also sets `is_deleted = true`. This contradicts the existing "Customer remains visible" UX promise and the archiving standard memory, and would break the **Cancellations tab**, commission unwinds, and refund analytics that rely on these rows being queryable. **Not recommended.**

### My recommendation

**Option B** — it's the cleanest fix for your frustration without breaking unwind/commission tracking. You get a one-click way to hide cancelled rows when you don't want to see them, while audit trails remain intact.

Let me know which option you'd like and I'll implement it.

