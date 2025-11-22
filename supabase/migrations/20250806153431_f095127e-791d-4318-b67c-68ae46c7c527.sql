-- Update the feedback email template with the new content
UPDATE email_templates 
SET 
  content = '{
    "greeting": "Hi {{customerFirstName}},",
    "content": "Thanks again for choosing Buy A Warranty — we''re so pleased to have you with us!\n\nWe''d really appreciate it if you could take a minute to share your experience by leaving us a review on Trustpilot. Your feedback helps other drivers make confident choices — and helps us continue providing the best service possible.\n\n👉 [Click here to leave your review](https://uk.trustpilot.com/review/buyawarranty.co.uk)\n\nYour policy runs until {{expiryDate}}, and you can manage everything easily through your [customer portal]({{portalUrl}}).\n\nAlso, don''t forget — if someone you refer takes out a policy, you get a £30 amazon voucher! Just share your personal link:\n🔗 {{referralLink}}\n\nThanks again for your trust and support. We''re always here if you need anything.\n\nWarm regards,\nThe Buy A Warranty Team\ninfo@buyawarranty.co.uk\nCustomer service: 0330 229 5040\nClaims line: 0330 229 5045"
  }'
WHERE template_type = 'feedback' AND name = 'Customer Feedback Request';