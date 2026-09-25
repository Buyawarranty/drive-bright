# Correct Miles human-contact handling

## Changes
- Remove the visible “Miles · AI assistant” label from every Miles message while keeping human specialist messages clearly identified.
- Make live human chat depend only on the existing staff **On duty / Off duty** switch. Do not imply anyone is joining unless a switched-on specialist actually replies.
- When no specialist is on duty, show exactly three customer actions: **Call us**, **WhatsApp us**, and **Request a callback**.
- Remove wording that says a specialist is being connected, alerted, available from opening hours alone, or will arrive “in a moment”.
- Keep existing chat history, callback capture, contact validation and staff reply handling unchanged.

## Technical details
- Update the customer chat window and contact panel only.
- Use the existing live-availability check and staff duty toggle as the source of truth.
- Verify both off-duty and on-duty customer states, then check the preview build. Do not publish.
