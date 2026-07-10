import React from 'react';
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
import ScrollToTopButton from '@/components/ui/ScrollToTopButton';
import pandaThumbs from '@/assets/panda-thumbs-up.png';
import pandaVehicles from '@/assets/panda-savings-vehicles.png';

const CAREERS_URL = 'https://buyawarranty.co.uk/careers/';
const JOB_POSTED = '2026-07-10';
const JOB_VALID_THROUGH = '2027-07-10';

const jobPostingSchema = {
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  title: 'Vehicle Warranty Sales Executive',
  description:
    '<p>Buyawarranty is hiring a remote UK-based Vehicle Warranty Sales Executive. Full-time PAYE employment with warm inbound and outbound leads, full training, uncapped commission and long-term career progression. Realistic OTE £35,000–£60,000+.</p><p>You will handle warm enquiries, recommend suitable vehicle warranty cover, explain benefits, close sales over the telephone and maintain accurate CRM records. Minimum two years telesales experience required.</p>',
  identifier: {
    '@type': 'PropertyValue',
    name: 'Buyawarranty',
    value: 'BAW-SALES-EXEC-2026',
  },
  datePosted: JOB_POSTED,
  validThrough: JOB_VALID_THROUGH,
  employmentType: 'FULL_TIME',
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
      maxValue: 60000,
      unitText: 'YEAR',
    },
  },
  experienceRequirements: {
    '@type': 'OccupationalExperienceRequirements',
    monthsOfExperience: 24,
  },
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

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://buyawarranty.co.uk/' },
    { '@type': 'ListItem', position: 2, name: 'Careers', item: CAREERS_URL },
  ],
};

const Careers: React.FC = () => {
  return (
    <main className="min-h-screen bg-[#F9FAFB] text-[#111827]">
      <SEOHead
        title="Vehicle Warranty Sales Executive Jobs UK | Remote PAYE | Buyawarranty Careers"
        description="Remote UK Vehicle Warranty Sales Executive role. Full-time PAYE, warm leads, uncapped commission, OTE £35,000–£60,000+. Apply to join the Buyawarranty sales team."
        keywords="warranty sales jobs, remote sales jobs UK, telesales jobs, vehicle warranty sales executive, PAYE sales jobs, work from home sales UK, uncapped commission sales, buyawarranty careers"
        canonical={CAREERS_URL}
        ogTitle="Vehicle Warranty Sales Executive – Remote UK | Buyawarranty Careers"
        ogDescription="Warm leads, full-time PAYE employment, uncapped commission. OTE £35,000–£60,000+. Join our UK vehicle warranty sales team."
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jobPostingSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>


      {/* Hero */}
      <section className="bg-white border-b border-[#E5E7EB]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full bg-[#FFF4EC] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F97316]">
                We're hiring
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Careers at Buyawarranty
              </h1>
              <p className="mt-4 text-lg font-semibold text-[#111827]">
                Vehicle Warranty Sales Executive
              </p>
              <p className="mt-3 max-w-xl text-base leading-7 text-[#6B7280]">
                Remote, UK · Full-time PAYE · Warm leads · Basic salary + uncapped commission ·
                OTE £35,000–£60,000+
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
                src={pandaThumbs}
                alt="Miles the Buyawarranty panda giving a thumbs up"
                className="w-64 md:w-80 h-auto object-contain"
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
              Buyawarranty is expanding its UK vehicle warranty sales team and is looking for
              experienced, confident sales professionals who know how to turn customer enquiries
              into sales.
            </p>
            <p>
              This is a fully remote telephone sales role working with customers who have already
              shown an interest in vehicle warranty products. You will help customers understand
              their options, recommend suitable levels of cover and guide them through the sales
              process.
            </p>
            <p>
              The position is offered on a full-time PAYE basis and is open to candidates based in
              the UK who can work UK business hours.
            </p>
            <p>
              High performers will also have opportunities for long-term career development and
              progression within the business.
            </p>
          </div>
        </section>

        {/* Earnings */}
        <section aria-labelledby="earnings" className="mb-14">
          <SectionHeader id="earnings" number={2} title="Typical annual earnings" />
          <div className="grid gap-5 md:grid-cols-3">
            <EarningsCard tier="New starter" range="£25,000–£35,000" />
            <EarningsCard tier="Experienced Sales Executive" range="£35,000–£50,000" highlight />
            <EarningsCard tier="Top Performer" range="£50,000–£60,000+" />
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
            We provide the training, tools and support you need to succeed.
          </p>

          <div className="grid gap-5 md:grid-cols-3">
            <PerkCard Icon={Users} title="Warm enquiries" body="Real customer leads already interested in warranty cover." />
            <PerkCard Icon={GraduationCap} title="Full training" body="Product and systems training with a clear sales process." />
            <PerkCard Icon={Headphones} title="Ongoing support" body="Coaching and mentoring from a UK-based team." />
            <PerkCard Icon={PoundSterling} title="Uncapped commission" body="Paid on every sale with monthly incentives and bonuses." />
            <PerkCard Icon={Home} title="Fully remote" body="Work from home with a supportive, connected team." />
            <PerkCard Icon={TrendingUp} title="Career progression" body="Long-term opportunities to grow within the business." />
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
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <SectionHeader id="looking-for" number={5} title="What we are looking for" />
              <p className="mb-6 max-w-2xl text-sm leading-6 text-[#6B7280]">
                We are looking for reliable, motivated and experienced sales professionals who
                are confident working independently from home.
              </p>
              <TickList
                items={[
                  'A minimum of two years’ telesales experience',
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
                src={pandaVehicles}
                alt="Miles the panda with vehicles"
                className="w-72 h-auto object-contain"
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
            <PerkCard Icon={Clock} title="UK business hours" body="Availability during standard UK working hours." />
          </div>
          <p className="mt-6 text-sm leading-6 text-[#6B7280]">
            A suitable headset with a microphone can be provided where required. Full onboarding,
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
              It may suit candidates from automotive sales, warranty sales, insurance, finance,
              call-centre sales or another high-volume telephone sales environment.
            </p>
            <p>
              You are likely to succeed in this role if you are confident on the phone, consistent
              with follow-up, comfortable working to targets and motivated by uncapped earning
              potential.
            </p>
          </div>
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
                'Your previous sales experience',
                'Your strongest sales results',
                'Why you believe you would succeed in vehicle warranty sales',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#F97316] mt-0.5 flex-none" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="mailto:careers@buyawarranty.co.uk?subject=Vehicle%20Warranty%20Sales%20Executive%20Application&body=Please%20attach%20your%20CV%20and%20a%20short%20note%20covering%3A%0A-%20Your%20previous%20sales%20experience%0A-%20Your%20strongest%20sales%20results%0A-%20Why%20you%20believe%20you%20would%20succeed%20in%20vehicle%20warranty%20sales"
              target="_top"
              rel="noopener"
              className="inline-flex items-center justify-center rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#EA580C] focus:outline-none focus:ring-4 focus:ring-orange-200"
            >
              Email your CV
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <a
              href="tel:03302295040"
              target="_top"
              rel="noopener"
              className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-sm font-bold text-[#111827] transition hover:bg-[#F9FAFB]"
            >
              Call 0330 229 5040
            </a>
          </div>

          {/* Role summary */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <SummaryItem Icon={Briefcase} label="Job type" value="Full-time" />
            <SummaryItem Icon={Award} label="Employment type" value="PAYE employee" />
            <SummaryItem Icon={Home} label="Location" value="Remote, United Kingdom" />
            <SummaryItem Icon={PoundSterling} label="Realistic OTE" value="£35,000–£60,000+" />
            <SummaryItem Icon={Clock} label="Experience" value="Min. 2 years' telesales" />
            <SummaryItem Icon={TrendingUp} label="Commission" value="Uncapped" />
          </div>
        </section>
      </div>

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
