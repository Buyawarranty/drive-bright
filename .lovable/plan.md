

# Activate ClickSend SMS -- Update Messages

## What's Already in Place
- ClickSend credentials (CLICKSEND_USERNAME, CLICKSEND_API_KEY) are configured
- The `send-clicksend-sms` edge function sends the initial SMS when a customer submits their quote
- The `sms-webhook` edge function handles YES, NO, and BACK replies
- The `sms_consents` table tracks consent status
- SMS is triggered from the Quote Delivery step (Step 2 of the customer journey)

## What Needs to Change

### 1. Update the Initial Welcome SMS
**File:** `supabase/functions/send-clicksend-sms/index.ts`

Update the `WELCOME_MESSAGE` to match the exact wording:

> BuyaWarranty: Your personalised vehicle warranty quote is ready. Avoid expensive repair bills on your vehicle.
> Reply YES to view your options or NO to opt out.

### 2. Update Reply Messages and Add STOP Handler
**File:** `supabase/functions/sms-webhook/index.ts`

The YES, NO, and BACK replies already match your wording. Two additions needed:

- **Add STOP keyword handling**: When a customer replies STOP, send:
  > BuyaWarranty: You've been opted out and will no longer receive messages from us.
  > If this was a mistake, reply START to re-subscribe.

- **Add START keyword handling**: Treat START the same as BACK -- re-subscribe the customer and send:
  > Thanks for reconnecting with us.
  > A BuyaWarranty expert will be in touch shortly to help you with your warranty options.
  > If you would like to speak to us now, call 0330 229 5040.

### 3. Deploy Edge Functions
Both `send-clicksend-sms` and `sms-webhook` will be redeployed with the updated messages.

---

## Technical Summary

| Item | Status |
|------|--------|
| ClickSend API keys | Already configured |
| Initial SMS trigger (Quote Step 2) | Already wired up |
| `sms_consents` table | Already exists with data |
| Welcome message wording | Needs update |
| STOP keyword | Needs adding |
| START keyword | Needs adding |
| YES / NO / BACK handling | Already correct |

No database changes needed. Only two edge function files are updated.

