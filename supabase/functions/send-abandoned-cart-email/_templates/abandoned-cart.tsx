import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface AbandonedCartEmailProps {
  firstName: string;
  vehicleReg: string;
  vehicleMake: string;
  vehicleModel: string;
  planName?: string;
  continueUrl: string;
  triggerType: 'pricing_page_view' | 'plan_selected' | 'pricing_page_view_24h' | 'pricing_page_view_72h';
}

export const AbandonedCartEmail = ({
  firstName = 'there',
  vehicleReg = '',
  vehicleMake = '',
  vehicleModel = '',
  planName = '',
  continueUrl = '',
  triggerType = 'plan_selected'
}: AbandonedCartEmailProps) => {
  
  // Content based on trigger type
  const getContent = () => {
    switch(triggerType) {
      case 'pricing_page_view_24h':
        return {
          subject: `${vehicleReg} - Your warranty quote from Buy A Warranty`,
          heading: `Your Warranty Quote for ${vehicleMake} ${vehicleModel}`,
          intro: `Hi ${firstName}, you requested a warranty quote for your ${vehicleMake} ${vehicleModel} (${vehicleReg}).`,
          body: "We've saved your quote details. You can review and complete your application whenever you're ready.",
          promoCode: "SAVE10NOW",
          promoText: "Special offer: Use code SAVE10NOW for 10% off (valid for 24 hours).",
          ctaText: "View My Quote"
        };
      
      case 'pricing_page_view_72h':
        return {
          subject: `${vehicleReg} - Warranty quote saved for ${vehicleMake} ${vehicleModel}`,
          heading: `Your Saved Warranty Quote`,
          intro: `Hi ${firstName}, this is a reminder about your warranty quote for ${vehicleReg}.`,
          body: "Your quote information is still available to review.",
          promoCode: "SAVE10NOW",
          promoText: "Limited time: Use code SAVE10NOW for 10% off your purchase.",
          ctaText: "View My Quote"
        };
      
      default:
        return {
          subject: `${vehicleReg} - Your warranty quote for ${vehicleMake} ${vehicleModel}`,
          heading: `Your Warranty Quote`,
          intro: `Hi ${firstName}, you recently requested a warranty quote for your ${vehicleMake} ${vehicleModel} (Registration: ${vehicleReg}).`,
          body: "We've saved your quote information and it's ready to review.",
          promoCode: null,
          promoText: "Your quote includes 3 months additional cover at no extra cost.",
          ctaText: "View My Quote"
        };
    }
  };

  const content = getContent();

  return (
    <Html>
      <Head />
      <Preview>{content.subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png"
              width="200"
              alt="Buy A Warranty"
              style={logo}
            />
          </Section>

          <Section style={content_section}>
            <Heading style={h1}>{content.heading}</Heading>
            
            <Text style={text}>Hi {firstName},</Text>
            
            <Text style={text}>{content.intro}</Text>
            
            <Text style={text}>{content.body}</Text>

            {content.promoCode && (
              <Section style={promoSection}>
                <Text style={promoText}>{content.promoText}</Text>
                <Text style={promoCode}>{content.promoCode}</Text>
              </Section>
            )}

            <Section style={benefitsSection}>
              <Text style={benefitsHeading}>Your Quote Includes:</Text>
              <Text style={benefitItem}>• Comprehensive vehicle warranty coverage</Text>
              <Text style={benefitItem}>• UK-based customer support</Text>
              <Text style={benefitItem}>• Straightforward claims process</Text>
              <Text style={benefitItem}>• 14-day cooling-off period</Text>
            </Section>

            <Section style={ctaSection}>
              <Link href={continueUrl} style={button}>
                {content.ctaText}
              </Link>
            </Section>

            <Hr style={hr} />

            <Text style={footer}>
              If you have any questions about your quote, please don't hesitate to contact us.
            </Text>

            <Text style={footer}>
              Best regards,<br />
              The Buy A Warranty Team<br />
              <Link href="https://buyawarranty.co.uk" style={link}>
                buyawarranty.co.uk
              </Link>
            </Text>

            <Text style={contactFooter}>
              📧 support@buyawarranty.co.uk<br />
              📞 0330 229 5040
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default AbandonedCartEmail

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
}

const header = {
  padding: '24px',
  textAlign: 'center' as const,
}

const logo = {
  margin: '0 auto',
}

const content_section = {
  padding: '0 48px',
}

const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '16px 0',
}

const text = {
  color: '#484848',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
}

const benefitsSection = {
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
}

const benefitsHeading = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 12px 0',
}

const benefitItem = {
  color: '#484848',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '4px 0',
}

const promoSection = {
  backgroundColor: '#fff3cd',
  border: '2px solid #ffc107',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  textAlign: 'center' as const,
}

const promoText = {
  color: '#856404',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0',
}

const promoCode = {
  backgroundColor: '#ffc107',
  color: '#000',
  fontSize: '24px',
  fontWeight: 'bold',
  padding: '12px 24px',
  borderRadius: '4px',
  display: 'inline-block',
  letterSpacing: '2px',
}

const ctaSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#0066cc',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '18px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 32px',
}

const tagline = {
  color: '#0066cc',
  fontSize: '18px',
  fontWeight: '600',
  textAlign: 'center' as const,
  margin: '24px 0',
}

const hr = {
  borderColor: '#e6ebf1',
  margin: '32px 0',
}

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '16px 0',
}

const contactFooter = {
  color: '#8898aa',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '8px 0',
}

const link = {
  color: '#0066cc',
  textDecoration: 'underline',
}
