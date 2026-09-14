# Fix New Leads note saving

## Changes
- Add a firm timeout around authentication, duplicate checking, inserts, updates, and abandoned-cart note saves so the interface cannot spin indefinitely.
- Reset both the visible saving state and the internal save lock if a request stalls.
- Keep the typed note and recovery queue until the database returns a confirmed saved row; show a clear retry message on failure.
- Refetch after success and preserve cached notes if loading fails.

## Verification
- Check the reported leads and recent note rows in the database.
- Test saving, reopening, and retry behaviour.
- Run the project checks after the change.
