import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { FileDown, Printer, PoundSterling, FileText } from 'lucide-react';
import { AgentScore } from '@/hooks/useScoreboardData';
import { format } from 'date-fns';

interface Props {
  agent: AgentScore | null;
  customerDeals?: { name: string; registration_plate: string | null; final_amount: number; created_at: string }[];
}

export const CommissionTimesheetForm: React.FC<Props> = ({ agent, customerDeals = [] }) => {
  const [companyName, setCompanyName] = useState('');
  const [dealRate, setDealRate] = useState('');
  const [extraCommission, setExtraCommission] = useState('');
  const [comments, setComments] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  if (!agent) return null;

  const monthLabel = format(new Date(), 'MMMM yyyy');
  const totalDeals = agent.salesCount;
  const totalRevenue = agent.revenue;
  const avgSale = agent.avgOrderValue;
  const parsedDealRate = parseFloat(dealRate) || 0;
  const parsedExtra = parseFloat(extraCommission) || 0;
  const calculatedCommission = totalDeals * parsedDealRate;
  const grandTotal = calculatedCommission + parsedExtra;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Commission Timesheet - ${agent.name} - ${monthLabel}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #1a1a1a; font-size: 13px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1a1a1a; padding-bottom: 20px; }
        .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
        .header p { color: #666; font-size: 14px; }
        .section { margin-bottom: 24px; }
        .section-title { font-size: 14px; font-weight: 700; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
        .field { display: flex; justify-content: space-between; padding: 4px 0; }
        .field-label { color: #666; }
        .field-value { font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 12px; }
        th { background: #f5f5f5; font-weight: 600; }
        .total-row { background: #f0fdf4; font-weight: 700; }
        .grand-total { font-size: 18px; font-weight: 700; text-align: right; margin-top: 16px; padding: 12px; background: #f0fdf4; border: 2px solid #22c55e; border-radius: 6px; }
        .comments { background: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid #eee; min-height: 60px; white-space: pre-wrap; }
        .signature { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .sig-line { border-top: 1px solid #999; padding-top: 8px; margin-top: 40px; color: #666; font-size: 12px; }
        .reg-plate { background: #fef9c3; border: 1px solid #eab308; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 11px; font-weight: 600; }
        @media print { body { padding: 20px; } }
      </style></head><body>
        <div class="header">
          <h1>Commission Timesheet</h1>
          <p>${monthLabel}</p>
        </div>

        <div class="section">
          <div class="section-title">Agent Details</div>
          <div class="grid">
            <div class="field"><span class="field-label">Name:</span><span class="field-value">${agent.name}</span></div>
            <div class="field"><span class="field-label">Email:</span><span class="field-value">${agent.email}</span></div>
            <div class="field"><span class="field-label">Company:</span><span class="field-value">${companyName || '—'}</span></div>
            <div class="field"><span class="field-label">Period:</span><span class="field-value">${monthLabel}</span></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Performance Summary</div>
          <div class="grid">
            <div class="field"><span class="field-label">Total Deals:</span><span class="field-value">${totalDeals}</span></div>
            <div class="field"><span class="field-label">Total Revenue:</span><span class="field-value">£${totalRevenue.toLocaleString()}</span></div>
            <div class="field"><span class="field-label">Average Sale:</span><span class="field-value">£${avgSale.toFixed(2)}</span></div>
            <div class="field"><span class="field-label">Conversion Rate:</span><span class="field-value">${agent.conversionRate.toFixed(1)}%</span></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Deals Breakdown</div>
          <table>
            <thead><tr><th>#</th><th>Customer</th><th>Reg Plate</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>
              ${customerDeals.map((d, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${d.name}</td>
                  <td>${d.registration_plate ? `<span class="reg-plate">${d.registration_plate}</span>` : '—'}</td>
                  <td>£${(d.final_amount || 0).toLocaleString()}</td>
                  <td>${format(new Date(d.created_at), 'dd MMM yyyy')}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="3">Total</td>
                <td>£${totalRevenue.toLocaleString()}</td>
                <td>${totalDeals} deals</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Commission Calculation</div>
          <div class="grid">
            <div class="field"><span class="field-label">Deals:</span><span class="field-value">${totalDeals}</span></div>
            <div class="field"><span class="field-label">Rate per deal:</span><span class="field-value">£${parsedDealRate.toFixed(2)}</span></div>
            <div class="field"><span class="field-label">Deal commission:</span><span class="field-value">£${calculatedCommission.toFixed(2)}</span></div>
            <div class="field"><span class="field-label">Extra commission/bonus:</span><span class="field-value">£${parsedExtra.toFixed(2)}</span></div>
          </div>
          <div class="grand-total">Total Commission: £${grandTotal.toFixed(2)}</div>
        </div>

        ${comments ? `
        <div class="section">
          <div class="section-title">Comments</div>
          <div class="comments">${comments}</div>
        </div>` : ''}

        <div class="signature">
          <div><div class="sig-line">Agent Signature</div></div>
          <div><div class="sig-line">Manager Signature</div></div>
        </div>

        <p style="text-align:center; margin-top:30px; color:#999; font-size:11px;">Generated on ${format(new Date(), 'dd MMMM yyyy, HH:mm')}</p>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5" />
          Commission Timesheet — {monthLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5" ref={printRef}>
        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-sm py-1 px-3">{totalDeals} deals</Badge>
          <Badge variant="outline" className="text-sm py-1 px-3 text-emerald-600 border-emerald-300">£{totalRevenue.toLocaleString()} revenue</Badge>
          <Badge variant="outline" className="text-sm py-1 px-3 text-indigo-600 border-indigo-300">£{avgSale.toFixed(0)} avg</Badge>
        </div>

        <Separator />

        {/* Form fields */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="company">Company / Individual Name</Label>
            <Input id="company" placeholder="e.g. Buy A Warranty Ltd" value={companyName} onChange={e => setCompanyName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dealRate">Commission Rate Per Deal (£)</Label>
            <Input id="dealRate" type="number" min="0" step="0.01" placeholder="e.g. 25.00" value={dealRate} onChange={e => setDealRate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="extraComm">Extra Commission / Bonus (£)</Label>
            <Input id="extraComm" type="number" min="0" step="0.01" placeholder="0.00" value={extraCommission} onChange={e => setExtraCommission(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Calculated Commission</Label>
            <div className="flex items-center h-10 px-3 border rounded-md bg-muted/30">
              <PoundSterling className="h-4 w-4 mr-1 text-muted-foreground" />
              <span className="font-bold text-lg text-emerald-600">{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="comments">Comments / Notes</Label>
          <Textarea id="comments" placeholder="Any additional notes for this month's commission..." rows={3} value={comments} onChange={e => setComments(e.target.value)} />
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </Button>
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <FileDown className="h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
