# Email Deliverability Guide - Avoiding Gmail Promotions Tab

## 1. DNS Checklist for Resend (CRITICAL)

Verify these settings at https://resend.com/domains:

### Required DNS Records
| Record Type | Purpose | Status Check |
|-------------|---------|--------------|
| **SPF** | Authorizes Resend to send on your behalf | ✅ `v=spf1 include:_spf.resend.com ~all` |
| **DKIM** | Cryptographically signs your emails | ✅ Two CNAME records from Resend |
| **DMARC** | Policy for failed authentication | ✅ `v=DMARC1; p=quarantine; rua=mailto:dmarc@buyawarranty.co.uk` |
| **Return-Path** | Bounce handling domain | ✅ CNAME to Resend's bounce domain |

### Verification Steps
1. Go to https://resend.com/domains
2. Click on `buyawarranty.co.uk`
3. Ensure all 4 DNS records show green checkmarks
4. Run verification test from Resend dashboard

### Test Your Domain
- Use https://mail-tester.com to score your email (aim for 9+/10)
- Use https://www.learndmarc.com to verify DMARC setup
- Check https://mxtoolbox.com/SuperTool.aspx for DNS health

---

## 2. Email Template Audit - Promotional Signals Found

### 🚨 HIGH PRIORITY - Triggers Promotions Tab

| Issue | Location | Fix |
|-------|----------|-----|
| Emoji in subject line | `send-welcome-email` - `🚗` | Remove emoji from subjects |
| "SAVE50POUNDS" promo code | `send-quote-email`, `send-abandoned-cart-email` | Move to separate marketing emails |
| "Valid for 24 hours only" urgency | Multiple templates | Soften urgency language |
| Yellow/Gold promotional boxes | Quote & abandoned cart emails | Use neutral colors |
| Multiple CTAs | Some templates have 2+ buttons | Single clear CTA per email |
| Marketing language | "Special offer", "Limited time" | Use conversational language |

### ⚠️ MEDIUM PRIORITY

| Issue | Location | Fix |
|-------|----------|-----|
| Generic greetings | "Hi there" fallback | Always use first name when available |
| Large images/logos | Multiple templates | Keep images under 40% of content |
| Tracking pixels | Email opens/clicks | Consider reducing tracking |
| Bulk sends | `send-marketing-email` uses batch | Send individually |

---

## 3. Sender Address Strategy

### Current Setup (Mixed Signals)
```
noreply@buyawarranty.co.uk - Transactional ✅
support@buyawarranty.co.uk - Support ✅
marketing@buyawarranty.co.uk - Marketing ⚠️ (triggers promotions)
claims@buyawarranty.co.uk - Claims ✅
notifications@buyawarranty.co.uk - Internal ✅
```

### Recommended Changes
- **Transactional emails**: Use a person's name + support domain
  - FROM: `"Sarah from Buy A Warranty" <sarah@buyawarranty.co.uk>`
- **Never use**: `marketing@` domain for any customer emails
- **Reply-to**: Always set a monitored inbox

---

## 4. Content Best Practices

### Subject Line Rules
✅ DO:
- `Your warranty is now active` (transactional)
- `Question about your warranty quote?` (conversational)
- `Your vehicle protection details` (informational)

❌ DON'T:
- `🚗 Your Buy A Warranty Policy Is Now Active 🚗` (emojis)
- `SAVE £50 - Limited Time Offer!` (promotional)
- `ACT NOW - Your Quote Expires Soon!` (urgency spam)

### Body Copy Rules
✅ DO:
- Write like a 1-to-1 personal email
- Use recipient's first name throughout
- Include reply instructions
- Keep promotional content minimal

❌ DON'T:
- Use bright promotional banners
- Include discount codes in transactional emails
- Use ALL CAPS for emphasis
- Add multiple competing CTAs

---

## 5. Email Type Separation

### Transactional (Primary Inbox)
- Welcome/confirmation emails
- Policy documents
- Password resets
- Claim confirmations
- Account notifications

### Marketing (Expect Promotions Tab)
- Discount offers
- Promotional campaigns
- Referral requests
- Review requests (borderline)

**Key Rule**: Never mix promotional content (discount codes) with transactional emails.

---

## 6. Technical Improvements

### Headers to Add
```typescript
headers: {
  'X-Entity-Ref-ID': `unique-id-${Date.now()}`, // Prevents threading issues
  'List-Unsubscribe': '<mailto:unsubscribe@buyawarranty.co.uk>', // Reduces spam complaints
}
```

### Reply-To Setup
Always set a reply-to address that's monitored:
```typescript
replyTo: 'support@buyawarranty.co.uk'
```

---

## 7. Implementation Priority

1. **Immediate**: Remove emojis from transactional email subjects
2. **Immediate**: Remove discount codes from welcome/quote emails
3. **This Week**: Verify all DNS records in Resend
4. **This Week**: Add personalization (first name) to all templates
5. **Next Sprint**: Separate promotional emails to dedicated campaigns
6. **Ongoing**: Monitor engagement and adjust

---

## 8. Engagement Tips

Gmail learns from user behavior:
- Ask customers to reply to your emails (increases trust signal)
- Add "Add us to your contacts" in first email
- Keep emails relevant and expected
- Send from consistent domains

---

*Last Updated: January 2026*
