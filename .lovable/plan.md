

## Fix: Notes Not Saving in Sales Admin Dashboard

### Root Cause Analysis

After investigating the database, RLS policies, and code:
- The database table `lead_quick_notes` and its RLS policies are correctly configured
- Notes ARE being saved for some users (140 notes exist, latest from minutes ago)
- The issue is **intermittent**, likely caused by **session expiration** during long dashboard sessions

The main problems identified:

1. **Session expiry during long tab sessions** - When a sales agent's tab is inactive (common during phone calls), the auth session expires. The current recovery logic tries once and gives up.
2. **No clear error feedback** - When the session refresh fails, the error toast may be missed or unclear.
3. **The `isSaving` state can get stuck** - If an unexpected error occurs, the Save button may remain disabled permanently until the lead is changed.

### Plan

**File: `src/hooks/useLeadQuickNotes.tsx`**

1. Add **retry logic** for session recovery - attempt `refreshSession()` up to 2 times with a small delay before giving up
2. Add a **fallback** that tries `getUser()` if `getSession()` returns null (sometimes the session is still valid but not cached)
3. Improve error messages to be more specific (e.g., "Session expired - please log in again" vs "Failed to save note")

**File: `src/components/admin/leads/notes/UnifiedNotesPanel.tsx`**

4. Add a **safety reset** for the `isSaving` state - if it's stuck for more than 10 seconds, auto-reset it
5. Add `e.preventDefault()` to the Enter key handler to prevent potential form submission conflicts
6. Add **optimistic UI update** - immediately show the note in the list while saving, and remove it if the save fails. This gives instant feedback to the user.

### Technical Details

- The session recovery will use `supabase.auth.getUser()` as a secondary check (server-side validation) before declaring the session expired
- The optimistic note will have a temporary ID (prefixed with `temp_`) and a subtle loading indicator
- If the save fails, the optimistic note is removed and the error toast is shown
- A `useRef` timer will track the `isSaving` duration and auto-reset after 10 seconds as a safety net
