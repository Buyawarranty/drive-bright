# Renewal eligibility and manager approval

## What will change
- Only customers with no claim history, no cancellation, and no refund will automatically enter New Leads for renewal.
- Customers with any claim history will be placed in a separate **Renewal approval** section and will not be contacted automatically.
- Customers with any cancellation or refund history will be placed in the same section as **Do not renew** and will not be eligible for automatic approval.
- Existing safety blocks for disputes, unresolved complaints, fraud or misrepresentation, contact restrictions, and unsubscribes will remain in force.

## Manager workflow
- Add a manager-only Renewal approval view showing the customer, vehicle, policy expiry, and every reason the renewal was held.
- Managers can approve a claim-history renewal after an explicit confirmation. Approval creates or attaches the renewal lead and records who approved it and when.
- Managers can mark a held customer as **Do not renew**, with an optional note.
- Cancellation/refund holds remain non-renewable; they are visible for review but cannot flow into New Leads.

## Existing renewal correction
- Move any claim-history renewal that was already generated but is still unworked out of New Leads and into Renewal approval.
- Preserve any lead with recorded customer activity rather than deleting history; it will be marked and held from further renewal contact.

## Technical details
- Add a secured renewal review table with status, reasons, manager decision, note, decision time, and audit identity. Only active management can view or change it; the service process can populate it.
- Centralise eligibility in the database so scheduled and manual renewal creation use identical rules.
- Match claims by policy where possible, with normalised email and registration fallbacks for older claims.
- Update the renewal generator to create review records instead of leads for claim, cancellation, or refund histories; forced creation will require a server-verified manager.
- Add the manager review UI to Renewals and update the project’s renewal architecture rule.

## Verification
- Check database counts for eligible, claim-held, and cancellation/refund-held policies.
- Verify an eligible policy creates a New Lead, a claimed policy stays held until approved, and a cancellation/refund policy cannot be approved.
- Confirm sales users cannot read or action the review list, and check the preview build.
