import React from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Home, PoundSterling, TrendingUp, Headphones, GraduationCap, Users, CheckCircle2, Briefcase, Laptop, Clock, Award } from 'lucide-react';
import CareersApplyBlock from '@/components/careers/CareersApplyBlock';
import careersHeroImage from '@/assets/telesales-sales-manager-vehicle-warranty-jobs-buyawarranty.png.asset.json';

export const SALES_MANAGER_ROLE = 'Remote Telesales Manager – Call Centre Sales';

const SM_KEYWORDS = 'remote telesales manager jobs, telesales manager jobs, call centre sales manager, contact centre manager jobs, remote sales manager, telesales team leader, vehicle warranty sales manager, warranty sales team leader, car warranty sales manager, inbound sales manager, outbound sales manager, remote team leader jobs, sales coaching jobs, KPI management jobs, sales performance manager, motor finance sales manager, car finance team leader, dealership sales manager, F&I manager jobs, GAP insurance sales manager, insurance sales manager, automotive account manager, vehicle warranty sales jobs, warranty manager jobs, used car sales manager jobs, motor trade sales executive, automotive aftermarket sales, B2B telesales jobs, outbound telesales jobs UK, work from home sales jobs, uncapped commission, insurance sales jobs, financial services sales, buyawarranty careers';

const teamManagement = [
  "Take full responsibility for the daily management of remote sales agents",
  "Monitor attendance, punctuality, availability and productivity",
  "Maintain professional standards, staff discipline and accountability",
  "Ensure every agent is working towards and achieving their individual sales targets",
  "Address poor performance and implement structured improvement plans",
  "Conduct regular remote team meetings and individual performance reviews",
  "Manage conduct and disciplinary matters fairly and in line with company procedures",
  "Build a motivated, focused and high-performing sales environment",
];

const kpiManagement = [
  "Set and monitor daily, weekly and monthly agent targets",
  "Track calls, contact rates, lead conversions and sales activity",
  "Monitor individual and overall team revenue and profitability",
  "Identify agents falling behind and intervene promptly",
  "Analyse performance dashboards and implement corrective action",
  "Improve conversion rates, call quality and customer outcomes",
  "Ensure sales targets are achieved through effective coaching and operational management",
  "Provide accurate performance reports and forecasts to senior management",
];

const systemsData = [
  "Manage daily operations through CRM platforms, cloud telephony, diallers and live KPI dashboards",
  "Track agent login status, call activity and customer follow-ups",
  "Ensure staff use approved laptops, software and telephone systems correctly",
  "Review call recordings and monitor sales quality",
  "Maintain accurate customer records and operational data",
  "Identify technical issues affecting agent productivity and coordinate support",
  "Ensure customer data is handled securely and in line with company policies and UK data protection requirements",
];

const coaching = [
  "Motivate agents to consistently achieve and exceed their targets",
  "Deliver daily sales briefings and regular remote coaching",
  "Improve objection handling, closing techniques and sales conversations",
  "Provide practical support to agents struggling with performance",
  "Identify top performers and encourage best practices across the team",
  "Introduce effective sales training, recognition and motivational initiatives",
  "Maintain a positive and accountable remote working culture",
];

const recruitment = [
  "Recruit, interview and onboard additional telesales agents",
  "Deliver effective training and performance expectations for new starters",
  "Monitor new-agent productivity and development",
  "Develop scalable management processes as headcount increases",
  "Introduce additional team leaders where operationally required",
  "Ensure growth in agent numbers translates into increased revenue and profitability",
];

const essentials = [
  "Minimum 3 years' experience managing a telesales or call centre sales operation",
  "A proven track record of consistently achieving sales KPIs and revenue targets",
  "Experience managing staff performance, attendance and discipline",
  "Strong knowledge of call centre productivity, conversion rates and reporting",
  "Experience using CRM software, diallers and call monitoring systems",
  "Confidence managing agents and performance through remote technology",
  "Proven ability to improve underperforming sales teams",
  "Experience recruiting, training and motivating sales agents",
  "Strong leadership, organisational and communication skills",
];

const desirable = [
  "Managing a fully remote telesales operation",
  "High-volume inbound or outbound consumer sales",
  "Vehicle warranties, automotive sales, insurance or financial-services telesales",
  "Scaling sales teams and developing supervisors",
];

const commission = [
  "Commission linked to qualifying team revenue and gross profit",
  "Additional earnings for exceeding agreed commercial targets",
  "Opportunity to increase commission as the number of productive agents grows",
  "Performance measured against conversion rates, sales quality and profitability",
  "Potential total annual earnings of up to £100,000 for exceptional results",
];

const lookingFor = [
  "Consistent achievement of sales targets",
  "Strong staff management and accountability",
  "Confidence managing remote agents through technology and data",
  "Effective motivation, coaching and performance improvement",
  "Ability to grow an operation without losing control of productivity",
  "Measurable improvements in revenue, conversions and commercial performance",
];

const applicationQuestions = [
  "What is the largest telesales team you have directly managed?",
  "Have you previously managed a fully remote telephone sales operation?",
  "Which CRM, dialler and telephone systems have you used?",
  "What KPIs and revenue targets were you personally accountable for?",
  "How do you manage agents who consistently fail to reach targets?",
  "Can you demonstrate previous improvements in sales conversions or revenue?",
  "How have you maintained staff discipline and productivity remotely?",
];

export const SalesManagerJob: React.FC = () => (
  <>
    <Helmet>
      <title>Remote Telesales Manager Jobs UK – Call Centre Sales | Buyawarranty</title>
      <meta name="description" content="Experienced Remote Telesales Manager wanted to run Buyawarranty's growing remote call centre sales operation. £45,000 basic plus team performance commission, up to £100,000 OTE. PAYE or self-employed." />
      <meta name="keywords" content={SM_KEYWORDS} />
    </Helmet>

    <section className="bg-white border-b border-[#E5E7EB]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full bg-[#FFF4EC] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F97316]">We're hiring</div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Careers at Buya<span className="text-brand-orange">warranty</span></h1>
            <p className="mt-4 text-lg font-semibold text-[#111827]">Remote Telesales Manager – Call Centre Sales</p>
            <p className="mt-3 max-w-xl text-base leading-7 text-[#6B7280]">
              <span className="font-bold">100% remote</span> (anywhere in the UK) · Full-time · PAYE or self-employed contractor · £45,000 basic + team performance commission · Up to £100,000 OTE
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href="#apply" className="inline-flex items-center justify-center rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#EA580C] focus:outline-none focus:ring-4 focus:ring-orange-200">
                Apply now<ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a href="#role" className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-sm font-bold text-[#111827] transition hover:bg-[#F9FAFB]">View the role</a>
            </div>
          </div>
          <div className="flex justify-center">
            <img src={careersHeroImage.url} alt="Remote telesales manager job in vehicle warranties – Miles the Buyawarranty panda leading a line-up of a car, van, SUV and motorbike" width={1920} height={640} className="w-full max-w-2xl h-auto object-contain" loading="eager" />
          </div>
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <section id="role" aria-labelledby="sm-about" className="mb-14">
        <Header id="sm-about" n={1} title="About the role" />
        <div className="space-y-4 text-sm leading-7 text-[#374151]">
          <p>Buyawarranty is a growing UK vehicle warranty company looking for an <strong>exceptional, experienced Telesales Manager</strong> to take full responsibility for our expanding remote sales operation.</p>
          <p><strong>We need a proven call centre leader who can manage a large team, maintain staff discipline, consistently achieve sales targets and drive profitable growth.</strong></p>
          <p>This is a hands-on management position requiring strong leadership, commercial awareness and the ability to run an entire telephone sales operation remotely.</p>
          <p>Our agents work from home using laptops, cloud-based telephone systems, diallers and CRM software. You must have the skills and experience to manage staff, monitor productivity and achieve results without being physically present.</p>
          <p><strong>Meeting agreed sales targets and KPIs is a fundamental requirement of this position. Exceptional performance beyond those targets is rewarded through additional commission.</strong></p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Perk Icon={Briefcase} title="Option 1 – PAYE employment" body="Guaranteed £45,000 basic salary plus performance-related commission. Fully remote UK-based employment with applicable statutory employment benefits and entitlements." />
          <Perk Icon={Award} title="Option 2 – Self-employed contractor" body="A self-employed arrangement may be considered for suitable candidates where the actual working relationship supports independent contractor status. Negotiable contractual remuneration, remote service delivery, and you manage your own tax affairs through Self Assessment, where applicable." />
        </div>
        <p className="mt-4 text-xs text-[#6B7280]">Employment arrangements are subject to the correct legal and tax classification.</p>
      </section>

      <section aria-labelledby="sm-resp" className="mb-14">
        <Header id="sm-resp" n={2} title="Key responsibilities" />
        <div className="space-y-8">
          <RespGroup title="Remote sales team management & staff discipline" intro="You must have proven experience managing 20–50+ telesales agents and be capable of managing a growing team as the business expands." items={teamManagement} />
          <RespGroup title="Sales targets & KPI management" intro="You will be accountable for achieving the agreed team sales targets and maintaining consistently strong performance." items={kpiManagement} />
          <RespGroup title="Remote systems & data management" items={systemsData} />
          <RespGroup title="Staff motivation, coaching & development" items={coaching} />
          <RespGroup title="Recruitment & team expansion" intro="Buyawarranty's remote telesales operation is growing, and you will be responsible for managing an increasing number of agents." items={recruitment} />
        </div>
      </section>

      <section aria-labelledby="sm-skills" className="mb-14">
        <Header id="sm-skills" n={3} title="Essential experience" />
        <p className="mb-4 text-sm leading-7 text-[#374151]"><strong>This role is for an experienced call centre sales manager, not a first-time team leader.</strong> Applicants must demonstrate:</p>
        <Ticks items={essentials} />
      </section>

      <section aria-labelledby="sm-industry" className="mb-14">
        <Header id="sm-industry" n={4} title="Desirable experience" />
        <Ticks items={desirable} />
      </section>

      <section aria-labelledby="sm-earn" className="mb-14">
        <Header id="sm-earn" n={5} title="Commission & earning potential" />
        <p className="mb-4 text-sm leading-7 text-[#374151]"><strong>We reward exceptional performance above the agreed minimum sales and KPI requirements.</strong> In addition to the basic salary, the successful candidate can earn commission based on the performance of the sales operation.</p>
        <Ticks items={commission} />
        <p className="mt-4 text-sm text-[#374151]">The commission structure and qualifying performance thresholds will be agreed before commencement.</p>
        <p className="mt-2 text-xs text-[#6B7280]">Commission is performance-based and not guaranteed. The advertised OTE represents exceptional earning potential.</p>
      </section>

      <section aria-labelledby="sm-who" className="mb-14">
        <Header id="sm-who" n={6} title="Who we're looking for" />
        <p className="mb-4 text-sm leading-7 text-[#374151]">We want someone who takes full ownership of team results, maintains high standards and knows how to manage a busy remote telesales operation. You must be able to demonstrate:</p>
        <Ticks items={lookingFor} />
      </section>

      <section aria-labelledby="sm-hours" className="mb-14">
        <Header id="sm-hours" n={7} title="Working hours" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Perk Icon={Clock} title="Monday to Friday" body="Standard weekday hours, fully remote." />
          <Perk Icon={Clock} title="Saturday half day" body="Twice a month, and flexible when you need it to reach targets." />
          <Perk Icon={Laptop} title="No travel" body="Fully remote, with no field sales or travel requirements." />
        </div>
      </section>

      <section aria-labelledby="sm-benefits" className="mb-14">
        <Header id="sm-benefits" n={8} title="Why join Buyawarranty?" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Perk Icon={GraduationCap} title="Full training" body="Product training and ongoing support from day one." />
          <Perk Icon={Headphones} title="Ongoing support" body="A supportive team behind you from day one." />
          <Perk Icon={TrendingUp} title="Earnings upside" body="Team performance commission with up to £100,000 OTE for exceptional results." />
        </div>
      </section>

      <section id="apply" aria-labelledby="sm-apply" className="rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF4EC] text-[#F97316]"><Award className="h-6 w-6" /></div>
          <h2 id="sm-apply" className="text-2xl font-bold">Apply for the Remote Telesales Manager role</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#6B7280]">If you're an experienced Telesales Manager who can run a disciplined, motivated and successful remote sales operation, consistently deliver targets and manage an expanding team, we'd like to hear from you. Take ownership. Drive performance. Deliver results.</p>
        </div>
        <div className="mt-8 rounded-2xl bg-[#F9FAFB] p-6 border border-[#E5E7EB]">
          <p className="text-sm font-semibold text-[#111827] mb-3">Please submit your CV and be prepared to answer:</p>
          <ol className="space-y-2 text-sm text-[#374151] list-decimal pl-5">
            {applicationQuestions.map(q => (
              <li key={q}>{q}</li>
            ))}
          </ol>
          <p className="mt-4 text-sm font-semibold text-[#111827]">Applicants must be able to demonstrate previous management success and measurable sales results.</p>
        </div>
        <CareersApplyBlock role={SALES_MANAGER_ROLE} experienceLabel="I have significant experience managing a telesales or contact-centre sales team" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Summary Icon={Briefcase} label="Job type" value="Full-time" />
          <Summary Icon={Award} label="Employment type" value="PAYE or self-employed" />
          <Summary Icon={Home} label="Location" value="100% remote, United Kingdom" />
          <Summary Icon={PoundSterling} label="Basic salary" value="£45,000 + team commission" />
          <Summary Icon={TrendingUp} label="Potential" value="Up to £100,000 OTE" />
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
const RespGroup = ({ title, intro, items, note }: { title: string; intro?: string; items: string[]; note?: string }) => (
  <div>
    <h3 className="mb-2 text-lg font-bold text-[#111827]">{title}</h3>
    {intro && <p className="mb-3 text-sm leading-7 text-[#374151]">{intro}</p>}
    <Ticks items={items} />
    {note && <p className="mt-3 text-sm font-semibold text-[#111827]">{note}</p>}
  </div>
);
const Perk = ({ Icon, title, body }: { Icon: IconT; title: string; body: string }) => (
  <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF4EC] text-[#F97316]"><Icon className="h-5 w-5" /></div>
    <h3 className="text-base font-bold">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-[#6B7280]">{body}</p>
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
