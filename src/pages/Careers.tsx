import React, { useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight,
  Home,
  PoundSterling,
  TrendingUp,
  Headphones,
  GraduationCap,
  Users,
  CheckCircle2,
  Briefcase,
  Wifi,
  Laptop,
  Clock,
  Award,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import CareersApplyBlock from '@/components/careers/CareersApplyBlock';
import BdmJob from '@/components/careers/BdmJob';
import SalesManagerJob from '@/components/careers/SalesManagerJob';
import { useSearchParams } from 'react-router-dom';
import ScrollToTopButton from '@/components/ui/ScrollToTopButton';
import TrustpilotMicroStarWidget from '@/components/TrustpilotMicroStarWidget';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import pandaThumbs from '@/assets/panda-thumbs-up.png';
import careersHeroImage from '@/assets/vehicle-warranty-sales-executive-careers-buyawarranty.png.asset.json';
import pandaVehicles from '@/assets/panda-savings-vehicles.png';
import pandaThumbsNew from '@/assets/panda-thumbs-new.png.asset.json';

const CAREERS_URL = 'https://buyawarranty.co.uk/careers/';
const JOB_POSTED = '2026-07-10';
const JOB_VALID_THROUGH = '2027-07-10';

const jobPostingSchema = {
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  title: 'Vehicle Warranty Sales Executive',
  description:
    '<p>Buyawarranty is hiring a remote UK-based Vehicle Warranty Sales Executive. Full-time PAYE employment with warm inbound and outbound leads, full training and uncapped commission. Realistic OTE £35,000–£80,000+.</p><p>You will handle warm enquiries, recommend suitable vehicle warranty cover, explain benefits, close sales over the telephone and maintain accurate CRM records. Minimum two years telesales experience required.</p><p>This role would suit someone with extensive telesales experience, or a car finance broker / finance broker from a car finance brokerage, motor finance, vehicle finance, dealership F&amp;I, GAP insurance or add-on product sales background.</p>',
  identifier: {
    '@type': 'PropertyValue',
    name: 'Buyawarranty',
    value: 'BAW-SALES-EXEC-2026',
  },
  datePosted: JOB_POSTED,
  validThrough: JOB_VALID_THROUGH,
  employmentType: ['FULL_TIME', 'PERMANENT', 'CONTRACTOR', 'TEMPORARY'],
  hiringOrganization: {
    '@type': 'Organization',
    name: 'Buyawarranty',
    sameAs: 'https://buyawarranty.co.uk',
    logo: 'https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png',
  },
  jobLocationType: 'TELECOMMUTE',
  applicantLocationRequirements: {
    '@type': 'Country',
    name: 'United Kingdom',
  },
  jobLocation: {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'GB',
    },
  },
  baseSalary: {
    '@type': 'MonetaryAmount',
    currency: 'GBP',
    value: {
      '@type': 'QuantitativeValue',
      minValue: 25000,
      maxValue: 80000,
      unitText: 'YEAR',
    },
  },
  experienceRequirements: {
    '@type': 'OccupationalExperienceRequirements',
    monthsOfExperience: 24,
  },
  jobBenefits:
    'Fully remote home-based working, warm inbound and outbound leads, full product and systems training, uncapped commission, monthly incentives, permanent and contract options',
  industry: 'Automotive Warranty Sales',
  occupationalCategory: '41-3099.00 Sales Representatives',
  workHours: 'UK business hours, Monday to Friday',
  directApply: false,
  applicationContact: {
    '@type': 'ContactPoint',
    contactType: 'HR',
    email: 'careers@buyawarranty.co.uk',
    telephone: '+44-330-229-5040',
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is this vehicle warranty sales job fully remote?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. The Vehicle Warranty Sales Executive role is fully remote and home-based anywhere in the UK. There is no office attendance and no commuting. You need reliable home broadband, a laptop or desktop, a quiet workspace and availability during UK business hours.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do you offer contract roles as well as permanent roles?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. We hire on both bases. Permanent roles are full-time PAYE employment with a basic salary plus uncapped commission. Contract roles are available for experienced sales people who prefer fixed-term, seasonal or self-employed contract work, with commission-led earnings. Tell us which you prefer when you apply and we can discuss both.',
      },
    },
    {
      '@type': 'Question',
      name: 'What experience do I need for this telesales role?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A minimum of two years telesales experience is required, and extensive telesales experience is preferred. Car finance broker or car finance brokerage experience is highly valued, as are backgrounds in motor finance, vehicle finance, dealership finance and insurance (F&I), GAP insurance or add-on product sales, insurance sales and high-volume outbound call-centre sales.',
      },
    },
    {
      '@type': 'Question',
      name: 'How much can I earn as a Vehicle Warranty Sales Executive?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Realistic on-target earnings are £35,000 to £80,000 or more. New starters typically earn £25,000 to £35,000, experienced sales executives £35,000 to £50,000, and top performers £50,000 to £80,000 or more. Commission is uncapped and paid on every warranty sale. Earnings examples are based on performance in similar sales roles and are not guaranteed.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is this a cold-calling job?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No, it is not a cold-calling-only position. You work warm inbound and outbound enquiries from customers who have already asked about vehicle warranty cover, plus follow-ups on existing quotations.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I apply for the sales job at Buyawarranty?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Apply on the Buyawarranty careers page by uploading your CV in the quick apply form, or email your CV to info@buyawarranty.co.uk. Include a short note on your sales experience, your strongest results and whether you are looking for a permanent or contract role.',
      },
    },
  ],
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://buyawarranty.co.uk/' },
    { '@type': 'ListItem', position: 2, name: 'Careers', item: CAREERS_URL },
  ],
};

const JOBS = [
  { id: 'sales', label: 'Vehicle Warranty Sales Executive' },
  { id: 'bdm', label: 'Business Development Manager' },
  { id: 'sales-manager', label: 'Remote Telesales Team Manager' },
] as const;

const JOB_ORDER_KEY = 'baw-careers-job-order';

// Restore a visitor's saved drag-and-drop order; fall back to the default order.
const loadJobOrder = (): Array<(typeof JOBS)[number]> => {
  try {
    const saved: string[] = JSON.parse(localStorage.getItem(JOB_ORDER_KEY) || '[]');
    const known = JOBS.filter((j) => saved.includes(j.id)).sort(
      (a, b) => saved.indexOf(a.id) - saved.indexOf(b.id),
    );
    const rest = JOBS.filter((j) => !saved.includes(j.id));
    const ordered = [...known, ...rest];
    return ordered.length === JOBS.length ? ordered : [...JOBS];
  } catch {
    return [...JOBS];
  }
};

const Careers: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [jobOrder, setJobOrder] = useState(loadJobOrder);
  const dragJobId = useRef<string | null>(null);
  const moveJob = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setJobOrder((prev) => {
      const from = prev.findIndex((j) => j.id === fromId);
      const to = prev.findIndex((j) => j.id === toId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      try {
        localStorage.setItem(JOB_ORDER_KEY, JSON.stringify(next.map((j) => j.id)));
      } catch {
        // Ignore storage failures; ordering still applies for this visit.
      }
      return next;
    });
  };
  const raw = params.get('job');
  const job = raw === 'bdm' || raw === 'sales-manager' ? raw : 'sales';
  const selectJob = (id: string) => {
    const next = new URLSearchParams(params);
    if (id === 'sales') next.delete('job'); else next.set('job', id);
    setParams(next, { replace: true });
    window.scrollTo({ top: 0 });
  };
  return (
    <main className="min-h-screen bg-[#F9FAFB] text-[#111827]">
      <SEOHead
        title="Remote Vehicle Warranty Sales & Telesales Jobs UK | Buyawarranty"
        description="Remote UK vehicle warranty sales jobs for experienced warranty sellers, car finance brokers and dealership salespeople. Telesales preferred; direct sales welcomed."
        keywords="vehicle warranty sales jobs, car warranty sales jobs, van warranty sales jobs, motorbike warranty sales jobs, motorcycle warranty sales jobs, warranty company jobs, warranty sales experience, vehicle warranty upselling, dealership warranty sales, forecourt sales jobs, used car dealership sales, car finance broker jobs, motor finance sales jobs, vehicle finance sales jobs, remote telesales jobs UK, telephone sales jobs, inbound telesales, outbound telesales, experienced telesales executives, direct sales experience, work from home sales jobs, permanent sales jobs, contract sales jobs, uncapped commission sales, buyawarranty careers"
        canonical={CAREERS_URL}
        ogTitle="Remote Vehicle Warranty Sales Jobs | Buyawarranty Careers"
        ogDescription="UK home-based warranty sales roles for experienced warranty sellers, car finance brokers and dealership or forecourt salespeople. Telesales experience preferred."
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jobPostingSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>


      <nav aria-label="Open jobs" className="sticky top-0 z-30 border-b border-[#E5E7EB] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
          <span className="mr-1 shrink-0 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Open jobs</span>
          {jobOrder.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => selectJob(j.id)}
              draggable
              onDragStart={() => { dragJobId.current = j.id; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragJobId.current) moveJob(dragJobId.current, j.id);
                dragJobId.current = null;
              }}
              onDragEnd={() => { dragJobId.current = null; }}
              title="Drag to reorder jobs"
              aria-pressed={job === j.id}
              className={`shrink-0 cursor-move rounded-full border px-4 py-2 text-sm font-semibold transition ${job === j.id ? 'border-[#F97316] bg-[#F97316] text-white' : 'border-[#E5E7EB] bg-white text-[#111827] hover:border-[#F97316]'}`}
            >
              {j.label}
            </button>
          ))}
        </div>
      </nav>

      {job === 'bdm' ? <BdmJob /> : job === 'sales-manager' ? <SalesManagerJob /> : (<>
      {/* Hero */}
      <section className="bg-white border-b border-[#E5E7EB]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full bg-[#FFF4EC] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F97316]">
                We're hiring
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Careers at Buya<span className="text-brand-orange">warranty</span>
              </h1>
              <p className="mt-4 text-lg font-semibold text-[#111827]">
                Vehicle Warranty Sales Executive
              </p>
              <p className="mt-3 max-w-xl text-base leading-7 text-[#6B7280]">
                <span className="font-bold">Fully remote</span> (work from home anywhere in the
                UK) · Contract or permanent roles ·
                Full-time PAYE or contract · Warm leads · Basic salary + uncapped commission ·
                OTE £35,000–£80,000+
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#apply"
                  className="inline-flex items-center justify-center rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#EA580C] focus:outline-none focus:ring-4 focus:ring-orange-200"
                >
                  Apply now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href="#role"
                  className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-sm font-bold text-[#111827] transition hover:bg-[#F9FAFB]"
                >
                  View the role
                </a>
              </div>
            </div>
            <div className="flex justify-center">
              <img
                src={careersHeroImage.url}
                alt="Vehicle warranty sales executive careers at Buyawarranty – Miles the panda with a You're Protected shield beside a car, van and SUV"
                width={1536}
                height={1024}
                className="w-full max-w-md md:max-w-lg h-auto object-contain"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Intro */}
        <section id="role" aria-labelledby="join-team" className="mb-14">
          <SectionHeader id="join-team" number={1} title="Join our growing sales team" />
          <div className="space-y-4 text-sm leading-7 text-[#374151]">
            <p>
              Buyawarranty is expanding its UK vehicle warranty sales team. We are looking for
              experienced, confident sales professionals who have sold vehicle warranties and
              know how to turn customer enquiries into sales. Experience at a warranty company,
              a car dealership or a forecourt, or as a car finance broker selling warranty products,
              is particularly relevant.
            </p>
            <p>
              This is a fully remote, work-from-home telephone sales role working with customers
              who have already shown an interest in vehicle warranty products. You will help
              customers understand their options, recommend suitable levels of cover and guide them
              through the sales process. We welcome experience selling or upselling warranties for
              cars, vans and motorbikes, including dealership add-on products and motor finance sales.
              There is no office attendance and no commuting. You can be based anywhere in the UK.
            </p>
            <p>
              We hire on both a permanent and a contract basis. Permanent roles are full-time PAYE
              employment with a basic salary plus uncapped commission. Contract roles are open to
              experienced sales people who prefer fixed-term, seasonal or self-employed contract
              work with commission-led earnings. Either way, the role is open to candidates based
              in the UK who can work UK business hours. Telesales experience is preferred, including
              inbound telephone sales, outbound telesales, handling objections and closing sales.
              Relevant direct sales experience is also welcomed, alongside vehicle warranty sales experience.
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <PerkCard
              Icon={Briefcase}
              title="Permanent roles"
              body="Full-time PAYE employment, basic salary and uncapped commission."
            />
            <PerkCard
              Icon={Clock}
              title="Contract roles"
              body="Fixed-term, seasonal or self-employed contracts for experienced sales people."
            />
            <PerkCard
              Icon={Home}
              title="Fully remote"
              body="Home-based anywhere in the UK — no office, no commute, UK business hours."
            />
          </div>
        </section>

        {/* Earnings */}
        <section aria-labelledby="earnings" className="mb-14">
          <SectionHeader id="earnings" number={2} title="Typical annual earnings" />
          <div className="grid gap-5 md:grid-cols-3">
            <EarningsCard tier="New starter" range="£25,000–£35,000" />
            <EarningsCard tier="Experienced Sales Executive" range="£35,000–£50,000" highlight />
            <EarningsCard tier="Top Performer" range="£50,000–£80,000+" />
          </div>
          <p className="mt-6 text-sm leading-6 text-[#6B7280]">
            Commission is paid on every warranty sale, with additional earning potential for
            consistent performers. There is no commission ceiling, and monthly incentives may
            also be available for strong results. Earnings examples are based on performance in
            similar sales roles and are not guaranteed.
          </p>
        </section>

        {/* Why join */}
        <section aria-labelledby="why-join" className="mb-14">
          <SectionHeader id="why-join" number={3} title="Why join Buyawarranty?" />
          <p className="mb-6 max-w-3xl text-sm leading-6 text-[#6B7280]">
            This is not a cold-calling-only position. You will work with warm inbound and outbound
            enquiries from customers who have already shown an interest in vehicle warranty cover.
            We provide the training and support you need to succeed.
          </p>

          <div className="grid gap-5 md:grid-cols-3">
            <PerkCard Icon={Users} title="Warm enquiries" body="Real customer leads already interested in warranty cover." />
            <PerkCard Icon={GraduationCap} title="Full training" body="Product and systems training with a clear sales process." />
            <PerkCard Icon={Headphones} title="Ongoing support" body="Coaching and mentoring from a UK-based team." />
            <PerkCard Icon={PoundSterling} title="Uncapped commission" body="Paid on every sale with monthly incentives and bonuses." />
            <PerkCard Icon={Home} title="Fully remote" body="Work from home with a supportive, connected team." />
          </div>
        </section>

        {/* Responsibilities */}
        <section aria-labelledby="responsibilities" className="mb-14">
          <SectionHeader id="responsibilities" number={4} title="Your responsibilities" />
          <p className="mb-6 max-w-3xl text-sm leading-6 text-[#6B7280]">
            As a Vehicle Warranty Sales Executive, you will be responsible for understanding
            customer needs and converting enquiries into sales.
          </p>
          <TickList
            items={[
              'Handling inbound and outbound customer enquiries',
              'Following up warm leads, quotations and previous enquiries',
              'Recommending suitable vehicle warranty products',
              'Explaining cover levels, benefits and key information clearly',
              'Handling customer questions and objections professionally',
              'Closing sales over the telephone',
              'Recording customer interactions accurately in the CRM',
              'Managing your own follow-ups and sales pipeline',
              'Meeting agreed sales, activity and conversion targets',
              'Delivering a professional customer experience at every stage',
            ]}
          />
        </section>

        {/* What we're looking for */}
        <section aria-labelledby="looking-for" className="mb-14">
          <div className="grid gap-8 md:grid-cols-[1fr_25%] md:items-center">
            <div>
              <SectionHeader id="looking-for" number={5} title="What we are looking for" />
              <p className="mb-6 max-w-2xl text-sm leading-6 text-[#6B7280]">
                We are looking for reliable, motivated and experienced sales professionals who
                are confident working independently from home. This role is well suited to
                someone with vehicle warranty sales experience from a warranty company, car
                dealership or forecourt, or a car finance broker who has sold warranty products.
              </p>
              <TickList
                items={[
                  'Experience selling vehicle warranties is required',
                  'Telesales experience is preferred; relevant direct sales experience is also welcomed',
                  'Warranty-company, dealership, forecourt or car finance broker experience is highly valued',
                  'Strong telephone sales and closing skills',
                  'A confident and professional telephone manner',
                  'Experience handling objections',
                  'A target-driven and self-motivated approach',
                  'Good organisation and time-management skills',
                  'Experience using CRM or sales systems',
                  'The ability to work independently',
                  'A reliable approach to attendance and follow-up',
                ]}
              />
            </div>
            <div className="hidden md:flex justify-center">
              <img
                src={pandaThumbsNew.url}
                alt="Miles the Buyawarranty panda giving a thumbs up"
                className="w-full h-auto object-contain"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        {/* Desirable */}
        <section aria-labelledby="desirable" className="mb-14">
          <SectionHeader id="desirable" number={6} title="Desirable experience" />
          <p className="mb-6 max-w-3xl text-sm leading-6 text-[#6B7280]">
            Experience in any of the following areas would be an advantage:
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              'Extensive telesales experience',
              'Vehicle warranty sales',
              'Warranty company experience',
              'Dealership warranty sales',
              'Forecourt warranty sales',
              'Car, van and motorbike warranty upselling',
              'Direct sales experience',
              'Inbound and outbound telephone sales',
              'Car finance broker',
              'Car finance brokerage',
              'Motor finance sales',
              'Vehicle finance sales',
              'Dealership finance and insurance (F&I)',
              'GAP insurance or add-on product sales',
              'Vehicle warranty sales',
              'Automotive sales',
              'Insurance sales',
              'Financial services sales',
              'Call-centre sales',
              'High-volume outbound sales',
              'Remote telephone sales',
              'B2C telephone sales',
            ].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] shadow-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* Remote requirements */}
        <section aria-labelledby="remote-req" className="mb-14">
          <SectionHeader id="remote-req" number={7} title="Remote-working requirements" />
          <p className="mb-6 max-w-3xl text-sm leading-6 text-[#6B7280]">
            As this is a home-based position, you will need:
          </p>
          <div className="grid gap-5 md:grid-cols-2">
            <PerkCard Icon={Wifi} title="Reliable internet" body="A stable high-speed home broadband connection." />
            <PerkCard Icon={Laptop} title="A computer" body="A laptop or desktop for CRM and calls." />
            <PerkCard Icon={Home} title="Quiet workspace" body="A professional environment free from distractions." />
            <PerkCard Icon={Clock} title="Working hours" body="Monday to Friday, plus a Saturday half day twice a month, and flexible when you need to reach targets." />
          </div>
          <p className="mt-6 text-sm leading-6 text-[#6B7280]">
            Full onboarding,
            product training and system setup support will be provided.
          </p>
        </section>

        {/* Who this suits */}
        <section aria-labelledby="who-suits" className="mb-14">
          <SectionHeader id="who-suits" number={8} title="Who this role would suit" />
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm space-y-4 text-sm leading-7 text-[#374151]">
            <p>
              This position is ideal for an experienced sales professional who wants to work
              remotely, speak with warm prospects and be rewarded for strong performance.
            </p>
            <p>
              It is particularly well suited to someone with telesales or direct sales experience
              who has sold vehicle warranties, whether at a warranty company, car dealership,
              forecourt or car finance brokerage. It may also suit candidates from automotive sales, warranty sales,
              insurance, dealership finance and insurance (F&amp;I), GAP insurance, call-centre
              sales or another high-volume telephone sales environment.
            </p>
            <p>
              You are likely to succeed in this role if you are confident on the phone, consistent
              with follow-up, comfortable working to targets and motivated by uncapped earning
              potential.
            </p>
          </div>
        </section>

        {/* FAQs */}
        <section aria-labelledby="careers-faq" className="careers-faq-theme mb-14">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b-2 border-primary pb-4">
            <h2 id="careers-faq" className="text-2xl font-bold text-foreground">
              Frequently asked questions
            </h2>
            <TrustpilotMicroStarWidget className="w-[200px] max-w-full shrink-0" />
          </div>
          <Accordion type="multiple" className="space-y-4">
            {faqSchema.mainEntity.map((item, index) => (
              <AccordionItem
                key={item.name}
                value={`careers-faq-${index}`}
                className="careers-faq-item overflow-hidden rounded-[14px] border border-border border-l-4 bg-card transition-colors hover:bg-accent data-[state=open]:bg-accent"
              >
                <AccordionTrigger className="min-h-[88px] gap-4 px-6 py-6 text-left text-base font-semibold text-foreground hover:no-underline md:min-h-[100px] md:px-[30px] md:text-lg [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-primary">
                  {item.name}
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 md:px-[30px]">
                  <p className="border-t border-border pt-4 text-base leading-7 text-muted-foreground">
                    {item.acceptedAnswer.text}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Apply */}
        <section
          id="apply"
          aria-labelledby="apply-heading"
          className="rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-sm"
        >
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF4EC] text-[#F97316]">
              <Award className="h-6 w-6" />
            </div>
            <h2 id="apply-heading" className="text-2xl font-bold">
              Apply to join our team
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#6B7280]">
              If you are an experienced sales professional looking for a remote PAYE position with
              warm leads, a basic salary and uncapped commission, we would like to hear from you.
            </p>
          </div>

          <div className="mt-8 rounded-2xl bg-[#F9FAFB] p-6 border border-[#E5E7EB]">
            <p className="text-sm font-semibold text-[#111827] mb-3">
              Please submit your CV with a short note explaining:
            </p>
            <ul className="space-y-2 text-sm text-[#374151]">
              {[
                'Your previous vehicle sales experience',
                'Your strongest sales results',
                'Why you believe you would succeed in car warranty sales',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#F97316] mt-0.5 flex-none" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <CareersApplyBlock />


          {/* Role summary */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <SummaryItem Icon={Briefcase} label="Job type" value="Full-time" />
            <SummaryItem Icon={Award} label="Employment type" value="PAYE employee" />
            <SummaryItem Icon={Home} label="Location" value="Remote, United Kingdom" />
            <SummaryItem Icon={PoundSterling} label="Realistic OTE" value="£35,000–£80,000+" />
            <SummaryItem Icon={Clock} label="Experience" value="Min. 2 years' telesales" />
            <SummaryItem Icon={TrendingUp} label="Commission" value="Uncapped" />
          </div>
        </section>
      </div>

      </>)}

      <ScrollToTopButton />
    </main>
  );
};

/* ---------- helper sub-components ---------- */

const SectionHeader: React.FC<{ id: string; number: number; title: string }> = ({ id, number, title }) => (
  <div className="mb-6 flex items-center gap-3">
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF4EC] text-sm font-bold text-[#F97316]">
      {number}
    </span>
    <h2 id={id} className="text-2xl font-bold">
      {title}
    </h2>
  </div>
);

const EarningsCard: React.FC<{ tier: string; range: string; highlight?: boolean }> = ({
  tier,
  range,
  highlight,
}) => (
  <article
    className={`rounded-2xl border p-6 shadow-sm ${
      highlight ? 'border-[#F97316] bg-[#FFF4EC]' : 'border-[#E5E7EB] bg-white'
    }`}
  >
    <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{tier}</p>
    <p className="mt-2 text-2xl font-bold text-[#111827]">{range}</p>
    <p className="mt-2 text-xs text-[#6B7280]">per year OTE</p>
  </article>
);

const PerkCard: React.FC<{
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}> = ({ Icon, title, body }) => (
  <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF4EC] text-[#F97316]">
      <Icon className="h-5 w-5" />
    </div>
    <h3 className="text-base font-bold">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-[#6B7280]">{body}</p>
  </article>
);

const TickList: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="grid gap-3 sm:grid-cols-2">
    {items.map((item) => (
      <li
        key={item}
        className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 text-sm leading-6 text-[#374151] shadow-sm"
      >
        <CheckCircle2 className="h-5 w-5 flex-none text-[#16A34A] mt-0.5" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const SummaryItem: React.FC<{
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}> = ({ Icon, label, value }) => (
  <div className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4">
    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#FFF4EC] text-[#F97316]">
      <Icon className="h-4 w-4" />
    </div>
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
      <p className="mt-0.5 font-semibold text-[#111827]">{value}</p>
    </div>
  </div>
);

export default Careers;
