import React from 'react';
import { Phone, Mail, MessageCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SocialLinks from '@/components/SocialLinks';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';

// Pages that have their own final CTA section
const pagesWithOwnCTA = ['/warranty-types/vans-warranty', '/warranty-types/vans-warranty/', '/cancellation-policy', '/cancellation-policy/', '/make-a-claim', '/make-a-claim/', '/add-evidence', '/add-evidence/', '/contact-us', '/contact-us/'];

const WebsiteFooter = () => {
  const location = useLocation();
  const hideCtaSection = pagesWithOwnCTA.includes(location.pathname);

  return (
    <div className="website-footer-theme relative">
      {/* CTA Section */}
      {!hideCtaSection && (
      <section className="bg-footer-banner py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-footer-banner-foreground mb-4">
            Ready to protect your vehicle?
          </h2>
          <p className="text-footer-banner-foreground/90 mb-6 max-w-2xl mx-auto">
            Get an instant quote and find the perfect warranty for your vehicle today from 60p a day.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="h-12 font-semibold"
            >
              Get your free quote
            </Button>
            <a 
              href="tel:03302295040" 
              className="text-footer-banner-foreground font-semibold text-lg hover:text-footer-banner-foreground/80 transition-colors flex items-center gap-2"
            >
              <Phone className="w-5 h-5" />
              0330 229 5040
            </a>
          </div>
        </div>
      </section>
      )}

      {/* Main Footer */}
      <footer className="bg-background pt-0 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 py-10 border-b border-border mb-10">
            <div className="min-w-0">
              <Link to="/" aria-label="Buy a Warranty home" className="inline-block">
                <img src={buyawarrantyLogo} alt="Buy a Warranty" className="h-12 w-auto max-w-full object-contain" loading="lazy" />
              </Link>
              <p className="text-sm text-muted-foreground mt-3">Vehicle warranty cover since 2016.</p>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground mb-4">Need advice? We're here to help.</h2>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:gap-x-6 text-sm font-medium">
                <a href="tel:03302295040" className="inline-flex items-center gap-2 text-primary hover:underline">
                  <Phone className="h-4 w-4 shrink-0" />0330 229 5040
                </a>
                <a href="mailto:support@buyawarranty.co.uk" className="inline-flex items-center gap-2 text-primary hover:underline break-all">
                  <Mail className="h-4 w-4 shrink-0" />support@buyawarranty.co.uk
                </a>
                <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 text-whatsapp hover:underline">
                  <MessageCircle className="h-4 w-4 shrink-0" />WhatsApp us
                </a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-8 mb-10">
            {/* Quick links */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4">Quick links</h3>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="/" className="hover:text-primary transition-colors">Home</a></li>
                <li><a href="/discount-promo-offers/" className="hover:text-primary transition-colors">Discounts & Offers</a></li>
                <li><a href="/customer-dashboard/" className="hover:text-primary transition-colors font-semibold">Customer Login</a></li>
                <li><a href="/make-a-claim/" className="hover:text-primary transition-colors">Make a Claim</a></li>
                <li><a href="/contact-us/" className="hover:text-primary transition-colors">Contact Us</a></li>
                <li><a href="/buy-a-used-car-warranty-reliable-warranties/" className="hover:text-primary transition-colors">Car Warranty</a></li>
                <li><a href="/van-warranty/" className="hover:text-primary transition-colors">Van Warranty</a></li>
                <li><a href="/ev-warranty/" className="hover:text-primary transition-colors">EV Warranty</a></li>
                <li><a href="/motorcycle-warranty/" className="hover:text-primary transition-colors">Motorbike Warranty</a></li>
                <li><a href="/car-extended-warranty/" className="hover:text-primary transition-colors">Extended Warranty</a></li>
                <li><a href="/warranty-types/" className="hover:text-primary transition-colors">Warranty Types</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4">Legal</h3>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="/privacy/" className="hover:text-primary transition-colors">Privacy Policy</a></li>
                <li><a href="/terms/" className="hover:text-primary transition-colors">Terms & Conditions</a></li>
                <li><a href="/cookies/" className="hover:text-primary transition-colors">Cookie Policy</a></li>
                <li><a href="/complaints/" className="hover:text-primary transition-colors">Make a complaint</a></li>
                <li><a href="/appeals/" className="hover:text-primary transition-colors">Make an Appeal</a></li>
                <li><a href="/thewarrantyhub/" className="hover:text-primary transition-colors">Warranty Hub</a></li>
                <li><a href="/used-car-warranty-uk/" className="hover:text-primary transition-colors">Used Car Warranty UK</a></li>
                <li><a href="/cancel-warranty" className="hover:text-primary transition-colors">Cancel your warranty</a></li>
                <li><a href="/cancellation-policy/" className="hover:text-primary transition-colors">Cancellation Policy</a></li>
                <li><a href="/careers/" className="hover:text-primary transition-colors">Careers</a></li>
              </ul>
            </div>

            {/* Help */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4">Help</h3>
              <div className="space-y-2.5 text-sm text-muted-foreground">
                <div>
                  <a href="/faq/" className="text-primary hover:text-primary/80 transition-colors font-semibold">
                    FAQs
                  </a>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Sales enquiries</p>
                  <a href="tel:03302295040" className="text-lg font-bold text-primary hover:underline">0330 229 5040</a>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Claims hotline</p>
                  <a href="tel:03302295045" className="text-lg font-bold text-primary hover:underline">0330 229 5045</a>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Email support</p>
                  <a href="mailto:support@buyawarranty.co.uk" className="text-primary font-medium hover:underline break-all">support@buyawarranty.co.uk</a>
                </div>
              </div>
            </div>

            {/* Cover by brand */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4">Cover by brand</h3>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="/car-extended-warranty/volkswagen/" className="hover:text-primary transition-colors">Volkswagen Warranty</a></li>
                <li><a href="/car-extended-warranty/mercedes-benz/" className="hover:text-primary transition-colors">Mercedes-Benz Warranty</a></li>
                <li><a href="/car-extended-warranty/bmw/" className="hover:text-primary transition-colors">BMW Warranty</a></li>
                <li><a href="/car-extended-warranty/citroen/" className="hover:text-primary transition-colors">Citroen Warranty</a></li>
                <li><a href="/car-extended-warranty/land-rover/" className="hover:text-primary transition-colors">Land Rover Warranty</a></li>
                <li><a href="/car-extended-warranty/ford/" className="hover:text-primary transition-colors">Ford Warranty</a></li>
                <li><a href="/car-extended-warranty/audi/" className="hover:text-primary transition-colors">Audi Warranty</a></li>
                <li><a href="/car-extended-warranty/nissan/" className="hover:text-primary transition-colors">Nissan Warranty</a></li>
                <li><a href="/car-extended-warranty/vauxhall/" className="hover:text-primary transition-colors">Vauxhall Warranty</a></li>
              </ul>
            </div>


          </div>



          {/* Company identity and regulatory disclosures stay separate from navigation. */}
          <div className="border-t border-border pt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
            <section aria-labelledby="footer-company-heading" className="min-w-0">
              <h3 id="footer-company-heading" className="text-sm font-semibold text-foreground mb-3">Company details</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Buyawarranty.co.uk is a trading name of Buy A Warranty Limited. Established 2016. Registered in the United Kingdom under Company number: 10314863.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                Registered address: Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT, England.
              </p>
              <p className="text-sm text-muted-foreground mt-2">VAT registration number 519 1099 85.</p>
            </section>
            <section aria-labelledby="footer-finance-heading" className="min-w-0">
              <h3 id="footer-finance-heading" className="text-sm font-semibold text-foreground mb-3">Finance and regulation</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Buy A Warranty Limited (FRN 1062024) is an appointed representative of Carfinanced Limited (FRN 1014460), which is authorised and regulated by the Financial Conduct Authority, for credit broking activities.
              </p>
              <p className="text-sm text-foreground font-medium mt-3">Buy A Warranty Limited acts as a credit broker, not a lender.</p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                We do not charge customers a fee for arranging finance and do not receive any commission for introducing customers to these providers.
              </p>
            </section>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-t border-border mt-8 pt-6">
            <p className="text-xs text-muted-foreground">© Buy a Warranty. All rights reserved.</p>
            <SocialLinks variant="dark" className="shrink-0" />
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WebsiteFooter;
