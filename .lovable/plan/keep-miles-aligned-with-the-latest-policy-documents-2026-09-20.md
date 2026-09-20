# Keep Miles aligned with the latest policy documents

## What will change
- Remove the hard-coded cancellation answers that override the approved documents.
- Rebuild Miles' approved knowledge from the latest Terms and Platinum Plan returned by Supabase, currently v3.8.
- Make the knowledge builder resolve the newest Supabase documents by default, so future rebuilds do not silently fall back to older bundled PDFs.
- Keep only management-approved clarifications that are not contradicted by the latest documents.
- Deploy Miles and test cancellation questions against the current wording.

## Current cancellation wording to enforce
- Within 14 days: full refund when no claim has been made or is in progress; typically processed within 5–7 working days.
- After 14 days, with no claim made or in progress: pro-rata unused-cover refund less £40 cancellation administration, £30 policy setup, and 14% of the remaining unused value.
- Once a claim has been submitted: the policy continues for its full term and is not eligible for cancellation or refund.
- The cancellation form remains a clickable link.

## Technical details
- Update the knowledge-build script to call Supabase's current-policy-document resolver first, with explicit local-file overrides retained for controlled rebuilds.
- Regenerate the deployed chatbot knowledge file from the resolved PDFs and Step 3 cover options.
- Tighten Miles' instructions so contractual answers must use document retrieval and cannot be answered from stale prompt text.
