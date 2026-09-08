---
name: Sale credit follows the agent who worked it
description: Non-website sales always credit the Sales/Sales Lead agent who worked the lead (notes or outbound calls as proof), never back-office logins
type: feature
---

Rule for sale credit allocation:

- If a lead was worked by a Sales / Sales Lead agent, the sale is ALWAYS that agent's, even if a back-office login (accounts@, info@, support@, backup@) confirmed the payment or sent the paperwork.
- Proof of work = the agent added notes on the lead OR made outbound calls (call logs) OR previously owned/was assigned the lead.
- Only genuine self-serve website purchases with no agent involvement are credited to "Website".
- Back-office / admin logins can never hold sale credit; `sale_credit_admin_user_id` is only honoured when it points to a Sales or Sales Lead user.
- Applied fix: Richard Lee (S7 RCL, £420, 25 Aug) was moved from accounts@ to Freddie Howard, whose lead it was.
