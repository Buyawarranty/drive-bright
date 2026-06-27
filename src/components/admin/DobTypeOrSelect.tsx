import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: string; // yyyy-MM-dd or ''
  onChange: (v: string) => void;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const pad = (n: number, l = 2) => n.toString().padStart(l, '0');

export const DobTypeOrSelect: React.FC<Props> = ({ value, onChange }) => {
  const parsed = value ? value.split('-') : [];
  const initY = parsed[0] || '';
  const initM = parsed[1] ? String(parseInt(parsed[1], 10)) : '';
  const initD = parsed[2] ? String(parseInt(parsed[2], 10)) : '';

  const [d, setD] = useState(initD);
  const [m, setM] = useState(initM);
  const [y, setY] = useState(initY);
  const [dayOpen, setDayOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);

  // Sync external -> internal
  useEffect(() => {
    setD(parsed[2] ? String(parseInt(parsed[2], 10)) : '');
    setM(parsed[1] ? String(parseInt(parsed[1], 10)) : '');
    setY(parsed[0] || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Internal -> external (only when all three are valid)
  useEffect(() => {
    const dn = parseInt(d, 10);
    const mn = parseInt(m, 10);
    const yn = parseInt(y, 10);
    if (!dn || !mn || !yn) return;
    if (y.length !== 4) return;
    if (mn < 1 || mn > 12) return;
    if (dn < 1 || dn > 31) return;
    if (yn < 1900 || yn > new Date().getFullYear()) return;
    const next = `${yn}-${pad(mn)}-${pad(dn)}`;
    if (next !== value) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, m, y]);

  const clear = () => {
    setD(''); setM(''); setY('');
    onChange('');
  };

  // age
  let age: number | null = null;
  if (d && m && y && y.length === 4) {
    const dob = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(dob.getTime())) {
      const t = new Date();
      age = t.getFullYear() - dob.getFullYear();
      const mm = t.getMonth() - dob.getMonth();
      if (mm < 0 || (mm === 0 && t.getDate() < dob.getDate())) age--;
    }
  }

  const fieldClass = "h-12 rounded-xl bg-sky-50 border-sky-200 hover:bg-sky-100 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:border-sky-300 font-medium text-slate-700 text-center pr-9";
  const chevronBtn = "absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-700 hover:bg-sky-100";

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 17;
  const years = Array.from({ length: 80 }, (_, i) => startYear - i);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-semibold text-slate-900">Date of Birth</Label>
        <span className="text-xs text-muted-foreground">(optional)</span>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="text-muted-foreground hover:text-foreground">
              <Info className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 text-sm" side="right">
            <p className="font-medium mb-1">Why do we need this?</p>
            <p className="text-muted-foreground">We use date of birth to securely verify identity at claim time. Type DD / MM / YYYY or tap the chevron for quick select.</p>
          </PopoverContent>
        </Popover>
        {age !== null && (
          <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
            Age {age}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_1.2fr_1.2fr_auto] gap-2 items-center max-w-lg">
        {/* DAY */}
        <div className="relative">
          <Input
            inputMode="numeric"
            maxLength={2}
            placeholder="DD"
            value={d}
            onChange={(e) => setD(e.target.value.replace(/\D/g, '').slice(0, 2))}
            className={cn(fieldClass)}
          />
          <Popover open={dayOpen} onOpenChange={setDayOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={chevronBtn} aria-label="Select day">
                <ChevronDown className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="end">
              <div className="grid grid-cols-7 gap-1 max-h-72 overflow-auto">
                {Array.from({ length: 31 }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { setD(String(n)); setDayOpen(false); }}
                    className={cn(
                      "h-9 rounded-md text-sm font-medium hover:bg-sky-100",
                      String(n) === d ? "bg-sky-500 text-white hover:bg-sky-500" : "text-slate-700"
                    )}
                  >{n}</button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* MONTH */}
        <div className="relative">
          <Input
            inputMode="numeric"
            maxLength={2}
            placeholder="MM"
            value={m}
            onChange={(e) => setM(e.target.value.replace(/\D/g, '').slice(0, 2))}
            className={cn(fieldClass)}
          />
          <Popover open={monthOpen} onOpenChange={setMonthOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={chevronBtn} aria-label="Select month">
                <ChevronDown className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <div className="grid grid-cols-1 gap-0.5 max-h-72 overflow-auto">
                {MONTHS.map((name, i) => {
                  const num = i + 1;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => { setM(String(num)); setMonthOpen(false); }}
                      className={cn(
                        "h-9 rounded-md text-sm font-medium text-left px-3 hover:bg-sky-100",
                        String(num) === m ? "bg-sky-500 text-white hover:bg-sky-500" : "text-slate-700"
                      )}
                    >
                      <span className="inline-block w-6 text-muted-foreground mr-2">{pad(num)}</span>
                      {name}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* YEAR */}
        <div className="relative">
          <Input
            inputMode="numeric"
            maxLength={4}
            placeholder="YYYY"
            value={y}
            onChange={(e) => setY(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className={cn(fieldClass)}
          />
          <Popover open={yearOpen} onOpenChange={setYearOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={chevronBtn} aria-label="Select year">
                <ChevronDown className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="end">
              <div className="text-xs font-medium text-muted-foreground px-2 pb-1.5">Select birth year</div>
              <div className="grid grid-cols-4 gap-1 max-h-72 overflow-auto">
                {years.map(yr => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => { setY(String(yr)); setYearOpen(false); }}
                    className={cn(
                      "h-9 rounded-md text-sm font-medium hover:bg-sky-100",
                      String(yr) === y ? "bg-sky-500 text-white hover:bg-sky-500" : "text-slate-700"
                    )}
                  >{yr}</button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {value ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            className="h-12 text-muted-foreground hover:text-destructive hover:bg-red-50 rounded-xl px-3"
            title="Clear date of birth"
          >
            Clear
          </Button>
        ) : <div />}
      </div>
    </div>
  );
};

export default DobTypeOrSelect;
