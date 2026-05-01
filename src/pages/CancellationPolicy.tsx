import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Repeat,
  Settings as Cog,
  PauseCircle,
  Phone,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import ScrollToTopButton from '@/components/ui/ScrollToTopButton';

const CancellationPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      <SEOHead
        title="Cancellation Policy | Buyawarranty"
        description="Read our clear and simple warranty cancellation policy. 14-day cooling-off period, pro-rata refunds, £40 processing fee. UK-based support team."
        keywords="cancellation policy, warranty cancellation, refund policy, buyawarranty"
      />

      {/* HERO */}
      <section className="bg-white border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16 text-center">
          <span className="inline-flex items-center gap-2 bg-brand-orange/10 border border-brand-orange/25 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-brand-orange mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
            Policy management
          </span>
          <h1
            className="font-bold leading-[1.05] tracking-tight mb-4 text-foreground"
            style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}
          >
            Cancellation policy
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto font-light">
            We hope you never need to cancel, but if you do, here is everything you need to know — clearly and simply.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-14">

        {/* SECTION 1 — OPTIONS */}
        <section className="mb-10">
          <SectionHeader number={1} title="Before you cancel, consider your options" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <OptionCard
              Icon={Repeat}
              title="Transfer your policy"
              body="Moving home or changing vehicle ownership? You may transfer your policy to a new address or a new owner."
              note="Address transfer is free. New owner transfer is £19."
            />
            <OptionCard
              Icon={Cog}
              title="Adjust your cover"
              body="Your circumstances have changed? We can modify your cover level to better suit your current needs — potentially saving you money."
            />
            <OptionCard
              Icon={PauseCircle}
              title="Pause your policy"
              body="Going away or have a temporary alternative arrangement? We may be able to pause your policy for a short period."
            />
          </div>
        </section>

        <Divider />

        {/* SECTION 2 — TIMELINE */}
        <section className="mb-10">
          <SectionHeader number={2} title="Cancelling your policy" />

          <div className="space-y-0">
            {/* Days 1–14 */}
            <TimelineItem period="Days 1–14" sub="Cooling-off period" active>
              <h3 className="text-base font-semibold text-foreground mb-2">
                Cancelling within the first 14 days
              </h3>
              <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
                <p>
                  Your cover starts immediately from the day you purchase, so a small deduction is made for the days you were covered. A £40 processing fee also applies.
                </p>
                <p>
                  <strong className="text-foreground font-semibold">If no claim has been made or is in progress</strong>, your refund is calculated as follows:
                </p>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-foreground text-white text-xs">
                      <th className="text-left px-3.5 py-2.5 font-semibold">Day you cancel</th>
                      <th className="text-left px-3.5 py-2.5 font-semibold">Days of cover used</th>
                      <th className="text-left px-3.5 py-2.5 font-semibold">Amount deducted</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {[
                      { d: 'Day 3', used: '3 days', amount: '3/365 of your cover plus £40' },
                      { d: 'Day 7', used: '7 days', amount: '7/365 of your cover plus £40' },
                      { d: 'Day 14', used: '14 days', amount: '14/365 of your cover plus £40' },
                    ].map((row, i) => (
                      <tr key={row.d} className={i < 2 ? 'border-b border-border' : ''}>
                        <td className="px-3.5 py-2.5 font-medium text-foreground">{row.d}</td>
                        <td className="px-3.5 py-2.5 text-muted-foreground">{row.used}</td>
                        <td className="px-3.5 py-2.5 text-muted-foreground">{row.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TimelineItem>

            {/* After day 14, no claim */}
            <TimelineItem period="After day 14" sub="No claim made">
              <h3 className="text-base font-semibold text-foreground mb-2">
                Cancelling after 14 days — no claim made
              </h3>
              <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
                <p>We work out how much of your policy is unused based on the time remaining.</p>
                <p>
                  A <strong className="text-foreground font-semibold">£40 processing fee</strong> is deducted from your refund, along with the cost of the time you have already been on cover.
                </p>
                <p>
                  We will confirm your exact refund amount and process it{' '}
                  <strong className="text-foreground font-semibold">within 5 to 7 working days</strong> of receiving your cancellation request.
                </p>
              </div>
            </TimelineItem>

            {/* Claim made */}
            <TimelineItem period="Any time" sub="Claim submitted" last>
              <h3 className="text-base font-semibold text-foreground mb-3">
                A claim has been made, is in progress or has been completed
              </h3>

              <div className="bg-foreground rounded-xl p-5 sm:p-6 text-white">
                <div className="text-base font-bold mb-2">No refund is payable</div>
                <p className="text-sm leading-relaxed text-white/70">
                  Once a claim has been submitted, no refund is payable — whether that claim is approved or not. Your policy remains active for the full remaining term, so you are still covered for any future repairs right up to your end date.
                </p>
                <ul className="mt-4 space-y-2">
                  {[
                    'From the moment a claim is submitted, our team gets to work — claims handlers, engineers and approved repairers.',
                    'The costs involved are real and immediate, whether or not the repair has been fully completed.',
                    'This applies whether your claim is being looked at, partially settled or fully resolved at the time you request cancellation.',
                  ].map((line) => (
                    <li key={line} className="flex gap-2.5 text-xs leading-relaxed text-white/70">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-orange flex-shrink-0" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </TimelineItem>
          </div>
        </section>

        <Divider />

        {/* SECTION 3 — SUMMARY */}
        <section className="mb-10">
          <SectionHeader number={3} title="Quick reference summary" />

          <div className="overflow-hidden rounded-xl border border-border shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-orange text-white">
                  <th className="text-left px-4 py-3 font-semibold">Your situation</th>
                  <th className="text-left px-4 py-3 font-semibold">What you get back</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    sit: 'Cancel within 14 days, no claim made',
                    out: 'Refund for unused days minus £40 processing fee',
                    good: true,
                  },
                  {
                    sit: 'Cancel within 14 days, claim made or in progress',
                    out: 'No refund',
                    good: false,
                  },
                  {
                    sit: 'Cancel after 14 days, no claim made',
                    out: 'Pro-rata refund for unused time minus £40 processing fee',
                    good: true,
                  },
                  {
                    sit: 'Cancel after 14 days, claim made, in progress or completed',
                    out: 'No refund',
                    good: false,
                  },
                ].map((row, i) => (
                  <tr key={row.sit} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F2F3F6]'}>
                    <td className="px-4 py-3.5 text-muted-foreground">{row.sit}</td>
                    <td
                      className={`px-4 py-3.5 font-semibold flex items-center gap-2 ${
                        row.good ? 'text-[#00875A]' : 'text-[#CC1C1C]'
                      }`}
                    >
                      {row.good ? (
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 flex-shrink-0" />
                      )}
                      {row.out}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Divider />

        {/* SECTION 4 — HOW TO CANCEL */}
        <section className="mb-10">
          <SectionHeader number={4} title="How to cancel your policy" />

          <div className="space-y-3">
            <HowStep n={1} title="Visit our cancellation page">
              Fill in the short form at{' '}
              <Link to="/cancel-warranty" className="text-brand-orange font-semibold hover:underline">
                buyawarranty.co.uk/cancel-warranty
              </Link>{' '}
              and we will take care of the rest.
            </HowStep>
            <HowStep n={2} title="We confirm within 3 working days">
              We will let you know the outcome of your cancellation request, including any refund amount due.
            </HowStep>
            <HowStep n={3} title="Not sure? Talk to us first">
              If you have any questions before cancelling or would like to explore your options, our team is always happy to help before you make a final decision.
            </HowStep>
          </div>
        </section>

        {/* CTA */}
        <div className="bg-white border border-border rounded-2xl shadow-sm p-7 sm:p-9 text-center">
          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1.5">
            Need help with your policy?
          </h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-xl mx-auto">
            Our UK-based team can help you explore alternatives to cancellation or answer any questions you have.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/cancel-warranty"
              className="inline-flex items-center gap-2 bg-brand-orange text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-brand-orange/90 transition-colors"
            >
              Visit cancellation page <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/contact-us/"
              className="inline-flex items-center gap-2 bg-white text-foreground border border-border px-6 py-3 rounded-xl font-medium text-sm hover:bg-muted transition-colors"
            >
              Explore alternatives
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-4 flex items-center justify-center gap-2">
            <Phone className="w-4 h-4" />
            Or call us on{' '}
            <a href="tel:03302295045" className="font-mono font-semibold text-foreground hover:underline">
              0330 229 5045
            </a>{' '}
            — Mon to Fri 8am to 8pm
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground/70 mt-8">
          This cancellation policy forms part of your full terms and conditions.
        </p>
      </div>

      <ScrollToTopButton />
    </div>
  );
};

/* ---------- helper sub-components ---------- */

const SectionHeader: React.FC<{ number: number; title: string }> = ({ number, title }) => (
  <div className="flex items-center gap-3 mb-5">
    <span className="w-8 h-8 rounded-full bg-brand-orange/10 text-brand-orange text-sm font-bold flex items-center justify-center flex-shrink-0">
      {number}
    </span>
    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
      {title}
    </h2>
  </div>
);

const OptionCard: React.FC<{
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  note?: string;
}> = ({ Icon, title, body, note }) => (
  <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
    <div className="w-10 h-10 rounded-lg bg-brand-orange/10 text-brand-orange flex items-center justify-center mb-3">
      <Icon className="w-5 h-5" />
    </div>
    <h3 className="text-[15px] font-semibold text-foreground mb-1.5">{title}</h3>
    <p className="text-[13px] text-muted-foreground leading-relaxed">{body}</p>
    {note && (
      <p className="text-xs text-brand-orange font-medium mt-2">{note}</p>
    )}
  </div>
);

const TimelineItem: React.FC<{
  period: string;
  sub: string;
  active?: boolean;
  last?: boolean;
  children: React.ReactNode;
}> = ({ period, sub, active, last, children }) => (
  <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[130px_1fr]">
    <div className="pt-5 pr-4 sm:pr-6 text-right">
      <div className={`text-[13px] font-bold ${active ? 'text-brand-orange' : 'text-foreground'}`}>
        {period}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
    <div className={`relative border-l-2 border-border pl-6 sm:pl-7 ${last ? 'pb-0' : 'pb-8'}`}>
      <span
        className={`absolute -left-[7px] top-[22px] w-3 h-3 rounded-full border-2 ${
          active ? 'bg-brand-orange border-brand-orange' : 'bg-white border-border'
        }`}
      />
      <div className="bg-white border border-border rounded-2xl p-5 sm:p-6 shadow-sm">
        {children}
      </div>
    </div>
  </div>
);

const HowStep: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({
  n,
  title,
  children,
}) => (
  <div className="bg-white border border-border rounded-xl p-4 sm:p-5 shadow-sm flex items-start gap-3.5">
    <span className="w-7 h-7 rounded-full bg-brand-orange text-white text-[13px] font-bold flex items-center justify-center flex-shrink-0">
      {n}
    </span>
    <div className="text-sm text-muted-foreground leading-relaxed">
      <strong className="block text-foreground font-semibold mb-0.5">{title}</strong>
      {children}
    </div>
  </div>
);

const Divider: React.FC = () => <div className="h-px bg-border my-8 sm:my-10" />;

export default CancellationPolicy;
