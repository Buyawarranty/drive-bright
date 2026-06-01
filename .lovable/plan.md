## Confirming current behaviour first

Looking at `src/components/admin/BatchPolicyQueue.tsx`:

- The batch **already auto-saves** to `localStorage` on every change (line 83-90) and survives page reloads. A small "Autosaved 1 Jun 2026, 15:43 • N pending" indicator shows under the header.
- **Printing** (letters, labels, Brother QL, Word addresses) logs each customer to `posted_letters_log` with `action_type = batch_print | batch_label | batch_word_addresses` and **keeps the queue intact** so you can keep adding more.
- **"Mark All Posted"** (the "printed & done" button) inserts every queued customer into `posted_letters_log` with `action_type = batch_posted` and **then clears the queue**. `posted_letters_log` is what feeds the **Letter Log** tab — so yes, that's the archive.

So the underlying flow already works. What's missing is visibility/confidence. Plan adds the following UI-only improvements:

## Changes to `BatchPolicyQueue.tsx`

### 1. Explicit "Save batch" button
Add a small `Save batch` button next to the autosave indicator that:
- Re-writes the queue to `localStorage` and updates `savedAt` immediately.
- Shows a toast "Batch saved — N customers".
- Purely a manual confirmation; autosave still runs on every change.

### 2. Clearer wording about persistence and the archive
Update the helper paragraph under the header to read:

> This batch is auto-saved — you can keep adding customers across sessions. Printing labels, letters or the Word address sheet does NOT clear the batch. Click **Mark All Posted** when every pack is in the post — the batch will then be archived to the **Letter Log** tab and cleared so you can start a new batch.

### 3. Make "Mark All Posted" confirmation explicit
Update the confirm dialog text to:

> Mark all N pack(s) as posted? They will be archived in the Letter Log and removed from this batch.

### 4. Optional: link to Letter Log after archiving
After `Mark All Posted` succeeds, the toast becomes:

> Batch archived to Letter Log — N entries cleared.

(plus a "View Letter Log" action in the toast that switches to that tab — only added if the tab-switch handler already exists; otherwise skip.)

## Out of scope
- No DB changes — `posted_letters_log` already powers the Letter Log archive.
- No change to print/label flows.
- No change to autosave behaviour itself.
