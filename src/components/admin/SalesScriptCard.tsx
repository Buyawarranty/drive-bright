import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Legend used throughout the script:
 *  • Bold  = key words to emphasise when speaking
 *  • •     = say it out loud (bullet lines the agent reads)
 *  → red italics = agent action — DO NOT read out
 */

type Line =
  | { kind: 'say'; text: React.ReactNode }
  | { kind: 'action'; text: React.ReactNode }
  | { kind: 'note'; text: React.ReactNode }
  | { kind: 'sub'; text: React.ReactNode }
  | { kind: 'list'; items: React.ReactNode[] };

interface ScriptSection {
  id: string;
  title: string;
  intro?: string;
  lines: Line[];
}

const SECTIONS: ScriptSection[] = [
  {
    id: 'intro',
    title: 'Intro',
    lines: [
      { kind: 'say', text: <>Hello, is that <b>(name)</b>?</> },
      { kind: 'say', text: <>It's <b>Greg from Buyawarranty</b>, how are you doing today?</> },
      { kind: 'say', text: <>Just giving you a quick call, you <b>popped some details through</b> about warranty cover for your <b>(Ford etc)</b>. We've got <b>offers available</b> at the moment, and I can find you a <b>better quote</b> than you'd get on the website.</> },
      { kind: 'say', text: <><b>Have you got the vehicle already?</b></> },
      { kind: 'say', text: <>Does it have a <b>warranty on it at the moment</b>?</> },
      { kind: 'say', text: <>Regarding <b>service history</b>, is it <b>partial or full</b>?</> },
      { kind: 'say', text: <>Let's go through some numbers together, it'll only take <b>2–3 mins</b>.</> },
      { kind: 'sub', text: 'OR' },
      { kind: 'say', text: <>That's great. What I can do is go through a quote with you, so let me just <b>load my portal up</b> and we'll go through the options.</> },
      { kind: 'action', text: <>Confirm the number plate.</> },
      { kind: 'say', text: <>What <b>mileage</b> is that currently on?</> },
    ],
  },
  {
    id: 'quote-intro',
    title: 'The quote',
    lines: [
      { kind: 'say', text: <>One of the <b>big differences with Buyawarranty</b>: every customer gets <b>one fully comprehensive plan</b> with <b>all important components included as standard</b>. Instead of bronze, silver or gold packages, we simply <b>tailor the labour rate, excess and claim limit</b> around your budget and vehicle.</> },
    ],
  },
  {
    id: 'length',
    title: '1. Length of coverage',
    lines: [
      { kind: 'say', text: <>How long would you like the <b>cover in place</b> for?</> },
      { kind: 'say', text: <><b>1 year</b>  |  <b>2 years</b> (most popular)  |  <b>3 years</b> (best value)</> },
      { kind: 'say', text: <>Regarding the <b>labour rate</b>, would you take the vehicle to a <b>local or independent garage</b>?</> },
      { kind: 'say', text: <><b>Independent garage:</b> most customers go for <b>£50 or £70</b>.  <b>Main dealer:</b> the <b>£100 or £200</b> tend to suit better.</> },
    ],
  },
  {
    id: 'excess',
    title: '2. Excess',
    lines: [
      { kind: 'say', text: <>Next question we have is: if you made a claim, <b>how much excess</b> would you like to pay?</> },
      { kind: 'say', text: <>Essentially, the <b>higher the excess, the lower your monthly payment</b>. We've got <b>£0, £50, £100, £150, £250 and £500</b>.</> },
      { kind: 'say', text: <><b>What are you comfortable with?</b> OR What works for yourself?</> },
      { kind: 'action', text: <>If they don't know:</> },
      { kind: 'say', text: <>Our <b>most popular options</b> are the <b>£150 and £250</b>.</> },
    ],
  },
  {
    id: 'claim-limit',
    title: '3. Claim limit: build value before price',
    lines: [
      { kind: 'say', text: <>Before I go through the monthly figure with you, I've actually got access to a <b>system that shows the most common faults</b> with your specific vehicle and <b>average repair costs</b> across the UK.</> },
      { kind: 'action', text: <>Search the vehicle in ChatGPT and quote its <b>top 3 faults</b>.</> },
      { kind: 'say', text: <>For your vehicle, the common issues are things like <b>turbo problems, gearbox faults and electrical failures</b>.</> },
      { kind: 'say', text: <>Now repairs like that can easily <b>run into the thousands</b>, which is why most customers prefer having the <b>peace of mind</b> of cover in place.</> },
      { kind: 'say', text: <>The <b>claim limit</b> is the <b>maximum</b> you can claim towards a repair, and you can make <b>unlimited claims</b>. Based on this, I'd go for <b>£2,000 or £3,000</b> (whichever is most appropriate).</> },
      { kind: 'say', text: <>So the price we've got is <b>£XX per month</b>, which comes to <b>£XX per year</b>, but if you make a <b>full payment</b> I can pop <b>another 10% discount</b> on there for you.</> },
      { kind: 'action', text: <><b>STOP TALKING</b> after quoting. Let them respond.</> },
    ],
  },
  {
    id: 'covered',
    title: '4. What is covered',
    lines: [
      { kind: 'action', text: <>Read through the list. If the car is <b>hybrid or EV</b>, make sure you read what's covered for that particular vehicle.</> },
    ],
  },
  {
    id: 'not-covered',
    title: "5. What isn't covered",
    lines: [
      { kind: 'say', text: <><b>Wear and tear</b> items, such as your <b>serviceable consumables</b>.</> },
      { kind: 'say', text: <><b>Pre-existing conditions</b>. If they have been repaired, that would <b>reset the lifespan</b> of the part and it <b>would be covered</b>.</> },
      { kind: 'say', text: <>The car just needs to be for <b>personal use</b>, rather than a <b>taxi, courier or hire car</b>.</> },
      { kind: 'say', text: <>Let me just check something for you. <b>CHECK MOT HISTORY HERE.</b></> },
      { kind: 'action', text: <>If the history is good:</> },
      { kind: 'say', text: <>I can see the car has a <b>spotless MOT history</b>. You've done a good job keeping the car well maintained. This is something the <b>claims department check</b> when reviewing a claim.</> },
      { kind: 'action', text: <>If the history is bad:</> },
      { kind: 'say', text: <>Looking at the MOT history, it's mainly just <b>general wear and tear</b> items, nothing major. Please ensure that when the policy is active you get the car <b>MOT'd and serviced on time</b>.</> },
      { kind: 'action', text: <>If there are bigger or repeated failures:</> },
      { kind: 'say', text: <>I can see a couple of <b>bigger items</b> on there. Just to be upfront, anything already showing as a fault counts as <b>pre-existing until it's repaired</b>, and once it's fixed it's <b>covered going forward</b>.</> },
    ],
  },
  {
    id: 'claim',
    title: '6. How to make a claim',
    lines: [
      { kind: 'say', text: <><b>Call the claims line</b> Monday to Friday, <b>9 to 5:30</b>. Take the vehicle to the <b>VAT-registered garage</b> of your choice.</> },
      { kind: 'say', text: <>They will do a <b>diagnostic or report</b> and send it over to us.</> },
      { kind: 'say', text: <>That will be <b>reviewed</b> and repairs can then begin.</> },
      { kind: 'say', text: <>Once repairs are completed and we receive the invoice, we will <b>settle it within 24 hours</b> with the garage directly.</> },
    ],
  },
  {
    id: 'close',
    title: 'The close: ask confidently',
    lines: [
      { kind: 'say', text: <><b>When are you looking to get the cover started from?</b></> },
      { kind: 'say', text: <>Would you prefer <b>monthly or annual payment</b>?</> },
      { kind: 'action', text: <>If hesitant:</> },
      { kind: 'say', text: <>So there's <b>zero risk</b> getting it set up today: you've got a <b>full 14 days</b> to read through everything, and if it's not right for you, you cancel and get a <b>full refund</b>.</> },
      { kind: 'action', text: <><b>NEVER</b> ask 'Would you like to think about it?'</> },
    ],
  },
  {
    id: 'mull',
    title: 'If they want time to mull it over',
    lines: [
      { kind: 'say', text: <>Was there <b>anything specifically</b> you wanted to think over, the <b>cover itself or the price</b>?</> },
      { kind: 'say', text: <>Just getting that <b>quote sent over</b> to you now. Is this the <b>right email</b>: bob@gmail.com?</> },
      { kind: 'say', text: <>Great, I'll also send you over a <b>second email</b> which will have all the <b>policy documents</b> so you know what's covered. It'll be from my <b>personal work email</b>.</> },
      { kind: 'say', text: <>I'm just gonna pop all the information over to you. Take some time to mull it over, and next time we connect you can ask me any further questions you might have.</> },
      { kind: 'say', text: <><b>When is a good time to give you a call back?</b> Ask for a <b>time and a day</b>.</> },
    ],
  },
];

// ---------- Render helpers ----------

const renderLine = (line: Line, i: number) => {
  if (line.kind === 'say') {
    return (
      <li key={i} className="text-sm leading-relaxed text-foreground pl-1">
        {line.text}
      </li>
    );
  }
  if (line.kind === 'action') {
    return (
      <div key={i} className="text-sm italic text-red-600 dark:text-red-400 my-1.5 pl-1">
        → {line.text}
      </div>
    );
  }
  if (line.kind === 'sub') {
    return (
      <div key={i} className="text-xs font-bold text-muted-foreground my-1 uppercase tracking-wide">
        {line.text}
      </div>
    );
  }
  if (line.kind === 'note') {
    return (
      <p key={i} className="text-sm text-muted-foreground my-1">{line.text}</p>
    );
  }
  return null;
};

// ---------- Printable HTML (Save as PDF from browser dialog) ----------

const renderLineHtml = (line: Line): string => {
  const toHtml = (node: React.ReactNode): string => {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(toHtml).join('');
    // React element
    const el = node as React.ReactElement;
    const tag = typeof el.type === 'string' ? el.type : 'span';
    const children = toHtml((el.props as { children?: React.ReactNode })?.children);
    return `<${tag}>${children}</${tag}>`;
  };
  if (line.kind === 'say') return `<li>${toHtml(line.text)}</li>`;
  if (line.kind === 'action') return `<div class="action">→ ${toHtml(line.text)}</div>`;
  if (line.kind === 'sub') return `<div class="sub">${toHtml(line.text)}</div>`;
  if (line.kind === 'note') return `<p class="note">${toHtml(line.text)}</p>`;
  return '';
};

const generatePrintHtml = () => `
<!DOCTYPE html>
<html><head><title>Buyawarranty — Sales Call Script</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; padding: 24px; color: #111; font-size: 12.5px; line-height: 1.55; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .sub-h { font-size: 12px; color: #555; margin-bottom: 6px; }
  .legend { font-size: 11px; color: #444; border: 1px solid #e5e7eb; background: #fafafa; padding: 8px 12px; border-radius: 6px; margin: 10px 0 16px; }
  .legend b { color: #111; }
  .legend .action { color: #b91c1c; font-style: italic; }
  .section { margin-bottom: 12px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; page-break-inside: avoid; }
  .section-title { font-size: 13.5px; font-weight: 700; margin-bottom: 8px; color: #0f172a; border-bottom: 2px solid #f97316; padding-bottom: 4px; }
  ul { list-style: disc; margin-left: 20px; }
  li { margin-bottom: 4px; }
  .action { color: #b91c1c; font-style: italic; margin: 4px 0; }
  .sub { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin: 4px 0; }
  .note { color: #6b7280; margin: 4px 0; }
  @media print { body { padding: 12px; } .section { page-break-inside: avoid; } }
</style></head><body>
<h1>Buyawarranty — Sales call script</h1>
<div class="sub-h">Print-ready quick reference guide</div>
<div class="legend">
  <b>Bold</b> = key words to hit &nbsp;•&nbsp; • = say it out loud &nbsp;•&nbsp;
  <span class="action">→ red italics = agent action, DO NOT read out</span>
</div>
${SECTIONS.map(s => `
  <div class="section">
    <div class="section-title">${s.title}</div>
    <ul>
      ${s.lines.filter(l => l.kind === 'say').map(renderLineHtml).join('')}
    </ul>
    ${s.lines.filter(l => l.kind !== 'say').map(renderLineHtml).join('')}
  </div>
`).join('')}
</body></html>`;

// ---------- Plain-text download ----------

const nodeToText = (node: React.ReactNode): string => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join('');
  const el = node as React.ReactElement;
  return nodeToText((el.props as { children?: React.ReactNode })?.children);
};

const generateTextContent = () => {
  let text = 'BUYAWARRANTY — SALES CALL SCRIPT\n';
  text += '='.repeat(50) + '\n';
  text += 'Bold = key words  •  bullet = say out loud  •  → = agent action (do not read)\n\n';
  SECTIONS.forEach(s => {
    text += `${s.title.toUpperCase()}\n${'-'.repeat(45)}\n`;
    s.lines.forEach(l => {
      if (l.kind === 'say') text += `  • ${nodeToText(l.text)}\n`;
      else if (l.kind === 'action') text += `  → ${nodeToText(l.text)}\n`;
      else if (l.kind === 'sub') text += `  ${nodeToText(l.text)}\n`;
      else if (l.kind === 'note') text += `  ${nodeToText(l.text)}\n`;
    });
    text += '\n';
  });
  return text;
};

export const SalesScriptCard: React.FC = () => {
  const scriptRef = useRef<HTMLDivElement>(null);

  const openPrintWindow = (autoPrint: boolean) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('Please allow pop-ups to continue'); return; }
    printWindow.document.write(generatePrintHtml());
    printWindow.document.close();
    if (autoPrint) {
      printWindow.onload = () => { printWindow.print(); };
    }
  };

  const handlePrint = () => openPrintWindow(true);

  const handleSavePdf = () => {
    // Opens the print dialog; browsers offer "Save as PDF" as a destination.
    openPrintWindow(true);
    toast.success('Tip: choose "Save as PDF" in the print dialog');
  };

  const handleDownload = () => {
    const blob = new Blob([generateTextContent()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Buyawarranty_Sales_Call_Script.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Sales script downloaded');
  };

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Buyawarranty sales call script</CardTitle>
            <p className="text-sm font-semibold text-foreground mt-0.5">Easy-to-follow desk guide</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <b>Bold</b> = key words to hit  •  • = say it out loud  •  <span className="italic text-red-600 dark:text-red-400">→ red italics = agent action, DO NOT read out</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSavePdf} className="gap-1.5">
              <FileText className="h-4 w-4" /> Save as PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
              <Download className="h-4 w-4" /> Download .txt
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent ref={scriptRef} className="space-y-3">
        {SECTIONS.map((section) => (
          <details key={section.id} open className="group rounded-lg border border-border overflow-hidden">
            <summary className="flex items-center gap-2 cursor-pointer select-none bg-muted/40 px-4 py-2.5 text-sm font-bold text-foreground hover:bg-muted/70 transition-colors">
              <span className="text-primary">›</span>
              <span className="border-b-2 border-primary/60 pb-0.5">{section.title}</span>
            </summary>
            <div className="px-4 py-3 text-foreground">
              <ul className="list-disc list-outside ml-5 space-y-1.5">
                {section.lines.map((l, i) => l.kind === 'say' ? renderLine(l, i) : null)}
              </ul>
              <div className="mt-2 space-y-1">
                {section.lines.map((l, i) => l.kind !== 'say' ? renderLine(l, i) : null)}
              </div>
            </div>
          </details>
        ))}

        <div className="text-center py-3 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">Updated Jul 2026</Badge>
          <p className="mt-1.5">Follow the script — build value before price, then close confidently.</p>
        </div>
      </CardContent>
    </Card>
  );
};
