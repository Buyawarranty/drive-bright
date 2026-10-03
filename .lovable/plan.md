# Separate Bumper date-of-birth page

## What will change
- Keep Step 4 focused on choosing and confirming the monthly Bumper option; remove the embedded DOB form from that page.
- When the customer continues with Bumper, validate all existing Step 4 details first, then show a dedicated Buy A Warranty DOB screen.
- Match the supplied design: checkout progress, clear “One last detail” heading, DD/MM/YYYY fields, soft-search reassurance, monthly payment summary, order summary, and one prominent continue button.
- Continue from this screen into the existing Bumper checkout handoff so the next external screen is the eligibility check, with the Step 4 address/details and entered DOB included.
- Include a back control so customers can return to Step 4 without losing their information.

## Behaviour preserved
- Existing Bumper pricing, discounts, tracking, customer details, address handling, attribution, and checkout creation remain unchanged.
- Pay-in-full and Payment Assist journeys remain unchanged.
- DOB remains a real-date, age 18+ validation requirement for Bumper only.

## Verification
- Test desktop and mobile layouts.
- Confirm invalid or under-18 dates cannot continue.
- Confirm valid DOB reaches the existing Bumper handoff with the stored Step 4 details.
- Run the DOB tests and check the preview build.
