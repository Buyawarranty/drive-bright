import React from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Home, PoundSterling, TrendingUp, Headphones, GraduationCap, Users, CheckCircle2, Briefcase, Laptop, Clock, Award, Phone } from 'lucide-react';
import CareersApplyBlock from '@/components/careers/CareersApplyBlock';
import careersHeroImage from '@/assets/careers-hero-panda-vehicles.png.asset.json';

export const SALES_MANAGER_ROLE = 'Telesales Sales Manager – Vehicle Warranties';

const SM_KEYWORDS = 'sales manager jobs, telesales manager jobs, remote sales manager, telesales team leader, call centre sales manager, contact centre manager jobs, vehicle warranty sales manager, warranty sales team leader, car warranty sales manager, inbound sales manager, outbound sales manager, remote team leader jobs, motor finance sales manager, car finance team leader, dealership sales manager, F&I manager jobs, GAP insurance sales manager, insurance sales manager, business development manager jobs, BDM jobs remote, automotive business development manager, warranty business development manager, dealer relationship manager jobs, dealer account manager, automotive account manager, car finance business development manager, motor finance BDM, dealer finance account manager, car finance broker jobs, motor finance broker jobs, vehicle warranty sales jobs, warranty sales executive, warranty manager jobs, used car sales manager jobs, motor trade sales executive, automotive aftermarket sales, GAP insurance sales jobs, vehicle protection products sales, B2B telesales jobs, outbound telesales jobs UK, cold calling jobs, new business sales jobs, remote B2B sales jobs, work from home sales jobs, uncapped commission, insurance sales jobs, financial services sales, recruitment sales jobs, buyawarranty careers';

const responsibilities = [
  "Lead, coach and motivate a fully remote telesales team selling vehicle warranties",
  "Set daily, weekly and monthly targets for calls, conversions and revenue",
  "Monitor call activity, call quality and CRM records, giving clear feedback",
  "Run daily huddles, one-to-ones and performance reviews over video and phone",
  "Listen to calls and coach on objection handling, closing and compliance",
  "Recruit, onboard and train new sales agents",
  "Manage lead allocation so every enquiry is worked quickly",
  "Handle escalated customer calls and support agents with complex sales",
  "Report on team performance, conversion rates and sales forecasts",
  "Ensure customers are treated fairly and products are explained clearly",
  "Lead by example, taking and closing calls when the team needs it",
];

const essentials = [
  "Proven experience managing or leading a telesales or contact-centre sales team",
  "Strong personal track record in telephone sales, ideally vehicle warranties",
  "Confident managing a remote team and keeping it motivated and accountable",
  "Excellent coaching skills \u2014 call listening, feedback and performance plans",
  "Comfortable working with targets, KPIs, dashboards and sales reports",
  "Experience using CRM systems, diallers and online sales tools",
  "Organised, resilient and calm under pressure",
  "Clear understanding of treating customers fairly in regulated sales",
  "Self-motivated and comfortable working independently from home",
];

const industries = [
  "Vehicle Warranty Sales Manager / Warranty Sales Team Leader",
  "Telesales Manager / Telesales Team Leader",
  "Contact Centre Sales Manager / Call Centre Manager",
  "Inbound or Outbound Sales Manager",
  "Remote Sales Manager / Virtual Team Leader",
  "Warranty Manager / Warranty Business Development Manager",
  "Car Finance Sales Manager / Motor Finance Team Leader",
  "Dealership Sales Manager / Used Car Sales Manager",
  "Business Manager / F&I Manager",
  "GAP Insurance / Vehicle Protection Products Sales Manager",
  "Automotive Aftermarket Sales Manager",
  "Insurance Sales Manager / Financial Services Sales Manager",
  "Senior Sales Executive ready to step up to management",
];

const benefits = [
  '£27,000 annual basic salary (PAYE)',
  '£40,000 on-target earnings',
  '£70,000+ exceptional earning potential',
  'Uncapped, performance-based commission',
  'Commission and bonuses based on team sales performance',
  'Fully remote working',
  'Company laptop, telephone system and CRM provided for PAYE employees',
  'Full product training and ongoing support',
  'Career progression opportunities',
  'Paid annual leave and workplace pension for eligible PAYE employees',
];

export const SalesManagerJob: React.FC = () => (
  <>
    <Helmet>
      <title>Remote Telesales Sales Manager Jobs UK – Vehicle Warranties | Buyawarranty</title>
      <meta name="description" content="Fully remote Sales Manager role leading a vehicle warranty telesales team. £27,000 basic, £40,000 OTE, £70,000+ potential, uncapped commission." />
      <meta name="keywords" content={SM_KEYWORDS} />
    </Helmet>

    <section className="bg-white border-b border-[#E5E7EB]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full bg-[#FFF4EC] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F97316]">We're hiring</div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Careers at Buyawarranty</h1>
            <p className="mt-4 text-lg font-semibold text-[#111827]">Sales Manager – Vehicle Warranty Telesales</p>
            <p className="mt-3 max-w-xl text-base leading-7 text-[#6B7280]">
              <span className="font-bold">Fully remote</span> (work from home anywhere in the UK) · Full-time permanent PAYE (contractor option available) · £27,000 basic + uncapped commission · OTE £40,000 · £70,000+ potential
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href="#apply" className="inline-flex items-center justify-center rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#EA580C] focus:outline-none focus:ring-4 focus:ring-orange-200">
                Apply now<ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a href="#role" className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-sm font-bold text-[#111827] transition hover:bg-[#F9FAFB]">View the role</a>
            </div>
          </div>
          <div className="flex justify-center">
            <img src={careersHeroImage.url} alt="Miles the Buyawarranty panda with a car, SUV, van and motorbike" className="w-full max-w-md md:max-w-lg h-auto object-contain" loading="eager" />
          </div>
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <section id="role" aria-labelledby="bdm-about" className="mb-14">
        <Header id="bdm-about" n={1} title="About the role" />
        <div className="space-y-4 text-sm leading-7 text-[#374151]">
          <p>Buyawarranty is a growing UK vehicle warranty telesales company. We are seeking an experienced, results-driven Sales Manager and vehicle warranty sales expert to lead, coach and grow our fully remote telesales team.</p>
          <p>This is a fully remote management position with a guaranteed basic salary and uncapped, performance-based commission. You will manage a home-based team of sales agents handling warm customer enquiries, drive call activity and conversions, coach every agent to hit target and step in on calls when needed.</p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Perk Icon={Briefcase} title="Permanent PAYE" body="Full-time permanent role, with a contractor option available." />
          <Perk Icon={Home} title="Fully remote" body="Work from home anywhere in the UK. No travel or field sales." />
          <Perk Icon={Phone} title="Remote team" body="Lead a home-based telesales team over phone and video." />
        </div>
      </section>

      <section aria-labelledby="bdm-earn" className="mb-14">
        <Header id="bdm-earn" n={2} title="Salary and earnings" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Earn tier="Basic salary" range="£27,000" />
          <Earn tier="On-target earnings" range="£40,000" highlight />
          <Earn tier="Exceptional potential" range="£70,000+" />
        </div>
        <p className="mt-4 text-xs text-[#6B7280]">Commission is uncapped. Earnings above basic depend on performance and are not guaranteed.</p>
      </section>

      <section aria-labelledby="bdm-resp" className="mb-14">
        <Header id="bdm-resp" n={3} title="Key responsibilities" />
        <Ticks items={responsibilities} />
      </section>

      <section aria-labelledby="bdm-skills" className="mb-14">
        <Header id="bdm-skills" n={4} title="Essential experience and skills" />
        <Ticks items={essentials} />
      </section>

      <section aria-labelledby="bdm-industry" className="mb-14">
        <Header id="bdm-industry" n={5} title="Relevant industry experience" />
        <p className="mb-4 text-sm leading-7 text-[#374151]">We particularly welcome applicants with experience in any of these positions or sectors. Automotive experience is desirable but not essential — strong outbound B2B salespeople from other sectors are encouraged to apply.</p>
        <Ticks items={industries} />
      </section>

      <section aria-labelledby="bdm-hours" className="mb-14">
        <Header id="bdm-hours" n={6} title="Working hours" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Perk Icon={Clock} title="Monday to Friday" body="Plus a half-day on alternate Saturday mornings." />
          <Perk Icon={Clock} title="Saturday pattern" body="Part of the normal contractual pattern, with no weekday off in lieu." />
          <Perk Icon={Laptop} title="No travel" body="Fully remote, with no field sales or travel requirements." />
        </div>
      </section>

      <section aria-labelledby="bdm-benefits" className="mb-14">
        <Header id="bdm-benefits" n={7} title="Salary and benefits" />
        <Ticks items={benefits} />
        <p className="mt-4 text-sm text-[#6B7280]">Contractor opportunities are also available, with separate remuneration and contractual terms.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Perk Icon={GraduationCap} title="Full training" body="Product training and ongoing support from day one." />
          <Perk Icon={Headphones} title="Kit provided" body="Laptop, phone system and CRM for PAYE employees." />
          <Perk Icon={TrendingUp} title="Progression" body="Grow with a business expanding its sales team." />
        </div>
      </section>

      <section id="apply" aria-labelledby="bdm-apply" className="rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF4EC] text-[#F97316]"><Award className="h-6 w-6" /></div>
          <h2 id="bdm-apply" className="text-2xl font-bold">Apply for the Sales Manager role</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#6B7280]">If you have led a successful telesales team — ideally selling vehicle warranties, motor finance or dealership add-on products — we'd like to hear from you.</p>
        </div>
        <div className="mt-8 rounded-2xl bg-[#F9FAFB] p-6 border border-[#E5E7EB]">
          <p className="text-sm font-semibold text-[#111827] mb-3">Please submit your CV with a short note explaining:</p>
          <ul className="space-y-2 text-sm text-[#374151]">
            {['The size and type of sales teams you have managed', 'Your team results against target', 'Your vehicle warranty or automotive sales background'].map(l => (
              <li key={l} className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-[#F97316] mt-0.5 flex-none" /><span>{l}</span></li>
            ))}
          </ul>
        </div>
        <CareersApplyBlock role={SALES_MANAGER_ROLE} experienceLabel="I have experience managing or leading a telesales team" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Summary Icon={Briefcase} label="Job type" value="Full-time, permanent" />
          <Summary Icon={Award} label="Employment type" value="PAYE (contractor option)" />
          <Summary Icon={Home} label="Location" value="Remote, United Kingdom" />
          <Summary Icon={PoundSterling} label="Basic / OTE" value="£27,000 / £40,000" />
          <Summary Icon={TrendingUp} label="Potential" value="£70,000+ uncapped" />
          <Summary Icon={Users} label="Team" value="Remote telesales" />
        </div>
      </section>
    </div>
  </>
);

type IconT = React.ComponentType<{ className?: string }>;
const Header = ({ id, n, title }: { id: string; n: number; title: string }) => (
  <div className="mb-6 flex items-center gap-3">
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF4EC] text-sm font-bold text-[#F97316]">{n}</span>
    <h2 id={id} className="text-2xl font-bold">{title}</h2>
  </div>
);
const Perk = ({ Icon, title, body }: { Icon: IconT; title: string; body: string }) => (
  <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF4EC] text-[#F97316]"><Icon className="h-5 w-5" /></div>
    <h3 className="text-base font-bold">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-[#6B7280]">{body}</p>
  </article>
);
const Earn = ({ tier, range, highlight }: { tier: string; range: string; highlight?: boolean }) => (
  <article className={`rounded-2xl border p-6 shadow-sm ${highlight ? 'border-[#F97316] bg-[#FFF4EC]' : 'border-[#E5E7EB] bg-white'}`}>
    <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{tier}</p>
    <p className="mt-2 text-2xl font-bold text-[#111827]">{range}</p>
    <p className="mt-2 text-xs text-[#6B7280]">per year</p>
  </article>
);
const Ticks = ({ items }: { items: string[] }) => (
  <ul className="grid gap-3 sm:grid-cols-2">
    {items.map(i => (
      <li key={i} className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 text-sm leading-6 text-[#374151] shadow-sm">
        <CheckCircle2 className="h-5 w-5 flex-none text-[#16A34A] mt-0.5" /><span>{i}</span>
      </li>
    ))}
  </ul>
);
const Summary = ({ Icon, label, value }: { Icon: IconT; label: string; value: string }) => (
  <div className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4">
    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#FFF4EC] text-[#F97316]"><Icon className="h-4 w-4" /></div>
    <div><p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p><p className="mt-0.5 font-semibold text-[#111827]">{value}</p></div>
  </div>
);

export default SalesManagerJob;
