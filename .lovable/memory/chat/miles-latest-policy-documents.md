---
name: Miles latest policy documents
description: Miles must use the newest approved Platinum Plan and Terms returned by Supabase for contractual answers.
type: feature
---
Miles must be rebuilt from the latest Platinum Warranty Plan and Terms and Conditions returned by `current_policy_pdf_urls()` in Supabase.

Never hard-code a document version or duplicate cancellation, refund, coverage, exclusion, transfer, claim-limit, excess, labour-rate, eligibility or claim-outcome terms in the chatbot prompt. These answers must be retrieved from the current approved knowledge passages.

The approved source set is the latest Supabase Platinum Plan, the latest Supabase Terms and Conditions, and the Step 3 cover options. Website pages, blogs and older documents are not approved sources.