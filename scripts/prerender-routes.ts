/**
 * Route metadata for build-time prerendering.
 *
 * Each entry produces a static `<route>/index.html` file at build time so that
 * social scrapers (WhatsApp, iMessage, Facebook, Twitter, LinkedIn, etc.) and
 * search engines see route-specific <title>, <meta description>, canonical,
 * and Open Graph tags — instead of the homepage defaults.
 *
 * Real users still get the SPA: the body is unchanged and React Router
 * hydrates normally on first paint.
 */

export interface RouteMeta {
  /** URL path, must start with `/`. Trailing slash is normalized. */
  path: string;
  title: string;
  description: string;
  /** Optional override for OG image. Falls back to the site default. */
  ogImage?: string;
}

const SITE = "https://buyawarranty.co.uk";
const DEFAULT_OG_IMAGE = `${SITE}/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png`;

export const DEFAULT_OG_IMAGE_URL = DEFAULT_OG_IMAGE;
export const SITE_URL = SITE;

export const PRERENDER_ROUTES: RouteMeta[] = [
  // ---------------- Footer / legal ----------------
  {
    path: "/cancellation-policy/",
    title: "Cancellation Policy | Buy A Warranty",
    description:
      "Read our cancellation policy. 14-day money back guarantee, refund eligibility and how to cancel your warranty plan.",
  },
  {
    path: "/cancel-warranty",
    title: "Cancel Your Warranty | Buy A Warranty",
    description:
      "Need to cancel your warranty? Check refund eligibility and submit a cancellation request online in minutes.",
  },
  {
    path: "/privacy/",
    title: "Privacy Policy | Buy A Warranty",
    description:
      "How Buy A Warranty collects, uses and protects your personal data. GDPR-compliant privacy policy for UK customers.",
  },
  {
    path: "/terms/",
    title: "Terms & Conditions | Buy A Warranty",
    description:
      "Terms and conditions for using buyawarranty.co.uk and purchasing a vehicle warranty plan.",
  },
  {
    path: "/cookies/",
    title: "Cookie Policy | Buy A Warranty",
    description:
      "How we use cookies on buyawarranty.co.uk and how you can manage your cookie preferences.",
  },
  {
    path: "/complaints/",
    title: "Complaints Procedure | Buy A Warranty",
    description:
      "How to raise a complaint with Buy A Warranty. Our resolution process, response times and escalation steps.",
  },
  {
    path: "/contact-us/",
    title: "Contact Us | Buy A Warranty",
    description:
      "Get in touch with Buy A Warranty. Call 0330 229 5040, email support@buyawarranty.co.uk, or message us on WhatsApp.",
  },
  {
    path: "/faq/",
    title: "Frequently Asked Questions | Buy A Warranty",
    description:
      "Answers to common questions about car, van, EV and motorbike warranties — claims, cover, pricing and more.",
  },
  {
    path: "/make-a-claim/",
    title: "Make a Claim | Buy A Warranty",
    description:
      "Submit a warranty claim online. Fast claims process, dedicated claims line on 0330 229 5045.",
  },
  {
    path: "/warranty-transfer",
    title: "Warranty Transfer | Buy A Warranty",
    description:
      "Selling your vehicle? Transfer your warranty to the new owner quickly and add value to the sale.",
  },
  {
    path: "/discount-promo-offers/",
    title: "Discounts & Promo Offers | Buy A Warranty",
    description:
      "Latest discounts and promotional offers on car, van, EV and motorbike warranty plans.",
  },
  {
    path: "/thewarrantyhub/",
    title: "The Warranty Hub | Drive Smarter | Buy A Warranty",
    description:
      "Guides, tips and articles to help you drive smarter and protect your vehicle.",
  },

  // ---------------- Main product pages ----------------
  {
    path: "/buy-a-used-car-warranty-reliable-warranties/",
    title: "Used Car Warranty | Reliable UK Cover | Buy A Warranty",
    description:
      "Comprehensive used car warranty cover from 60p a day. Protect your car against unexpected repair bills.",
  },
  {
    path: "/van-warranty/",
    title: "Van Warranty | UK Van Cover | Buy A Warranty",
    description:
      "Affordable van warranty cover for tradespeople and businesses. Instant quotes, flexible plans.",
  },
  {
    path: "/ev-warranty/",
    title: "EV Warranty | Electric Vehicle Cover | Buy A Warranty",
    description:
      "Specialist warranty cover for electric vehicles. Battery, motor and drivetrain protection.",
  },
  {
    path: "/motorcycle-warranty/",
    title: "Motorbike Warranty | UK Motorcycle Cover | Buy A Warranty",
    description:
      "Reliable warranty cover for motorbikes. Protect against unexpected mechanical and electrical failures.",
  },
  {
    path: "/car-extended-warranty/",
    title: "Extended Car Warranty UK | Buy A Warranty",
    description:
      "Extend your car warranty with flexible UK plans. Instant quotes, no hidden fees.",
  },
  {
    path: "/warranty-types/",
    title: "Warranty Types | Choose Your Plan | Buy A Warranty",
    description:
      "Compare warranty types and find the right plan for your car, van, EV or motorbike.",
  },
  {
    path: "/warranty-types/vans-warranty/",
    title: "Vans Warranty | Buy A Warranty",
    description:
      "Specialist vans warranty plans designed for trade and business use.",
  },
  {
    path: "/used-car-warranty-uk/",
    title: "Used Car Warranty UK | Buy A Warranty",
    description:
      "Trusted UK used car warranty provider. 5-star reviews, instant online quotes from 60p a day.",
  },

  // ---------------- Brand-specific PPC landing pages ----------------
  {
    path: "/car-extended-warranty/mercedes-benz/",
    title: "Mercedes-Benz Extended Warranty Cover from £19/month | Buy A Warranty",
    description:
      "Protect your Mercedes-Benz from unexpected repair bills with flexible UK warranty cover from £19/month. Instant online quote in under 60 seconds.",
    ogImage: `${SITE}/__l5e/assets-v1/207b7a00-2fce-48b8-9893-e9deb63e4a0d/mercedes-panda-hero.png`,
  },
  {
    path: "/car-extended-warranty/volkswagen/",
    title: "Volkswagen Extended Warranty Cover from £19/month | Buy A Warranty",
    description:
      "Protect your Volkswagen from unexpected repair bills with flexible UK warranty cover from £19/month. Instant online quote in under 60 seconds.",
    ogImage: `${SITE}/__l5e/assets-v1/a8654212-2d11-434d-84c0-7ac213730b6d/vw-panda-hero.png`,
  },
  {
    path: "/car-extended-warranty/bmw/",
    title: "BMW Extended Warranty Cover from £19/month | Buy A Warranty",
    description:
      "Protect your BMW from unexpected repair bills with flexible UK warranty cover from £19/month. Instant online quote in under 60 seconds.",
    ogImage: `${SITE}/__l5e/assets-v1/c5a3804c-e712-43cb-aaf7-d8e1dff42533/bmw-panda-hero.png`,
  },
  {
    path: "/car-extended-warranty/audi/",
    title: "Audi Extended Warranty Cover from £19/month | Buy A Warranty",
    description:
      "Protect your Audi from unexpected repair bills with flexible UK warranty cover from £19/month. Instant online quote in under 60 seconds.",
    ogImage: `${SITE}/__l5e/assets-v1/546b3135-5645-4d9f-b5ee-076fa2745d48/audi-hero-panda-cars.png`,
  },
  {
    path: "/car-extended-warranty/nissan/",
    title: "Nissan Extended Warranty Cover from £19/month | Buy A Warranty",
    description:
      "Protect your Nissan from unexpected repair bills with flexible UK warranty cover from £19/month. Instant online quote in under 60 seconds.",
    ogImage: `${SITE}/__l5e/assets-v1/43bea0eb-75cf-4a29-9b93-7a3efd4e1de7/nissan-hero-panda-cars.png`,
  },
];

