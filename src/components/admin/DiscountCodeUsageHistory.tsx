import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { DateRange } from "react-day-picker";

interface UsageRecord {
  id: string;
  customer_email: string;
  vehicle_reg: string | null;
  discount_amount: number;
  order_amount: number;
  used_at: string;
  discount_code_id: string;
  code_name: string;
  code_type: string;
  code_value: number;
}

export function DiscountCodeUsageHistory() {
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    fetchUsageHistory();
  }, []);

  const fetchUsageHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("discount_code_usage")
        .select("*, discount_codes(code, type, value)")
        .order("used_at", { ascending: false });

      if (error) throw error;

      const mapped: UsageRecord[] = (data || []).map((r: any) => ({
        id: r.id,
        customer_email: r.customer_email,
        vehicle_reg: r.vehicle_reg,
        discount_amount: r.discount_amount,
        order_amount: r.order_amount,
        used_at: r.used_at,
        discount_code_id: r.discount_code_id,
        code_name: r.discount_codes?.code || "Unknown",
        code_type: r.discount_codes?.type || "fixed",
        code_value: r.discount_codes?.value || 0,
      }));

      setUsageRecords(mapped);
    } catch (error) {
      console.error("Error fetching usage history:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return usageRecords.filter((r) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesCode = r.code_name.toLowerCase().includes(term);
        const matchesEmail = r.customer_email.toLowerCase().includes(term);
        const matchesReg = r.vehicle_reg?.toLowerCase().includes(term);
        if (!matchesCode && !matchesEmail && !matchesReg) return false;
      }

      // Date range filter
      if (dateRange?.from) {
        const usedDate = new Date(r.used_at);
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        if (usedDate < from) return false;

        if (dateRange.to) {
          const to = new Date(dateRange.to);
          to.setHours(23, 59, 59, 999);
          if (usedDate > to) return false;
        }
      }

      return true;
    });
  }, [usageRecords, searchTerm, dateRange]);

  const totalDiscountGiven = useMemo(
    () => filteredRecords.reduce((sum, r) => sum + r.discount_amount, 0),
    [filteredRecords]
  );

  const totalOrderValue = useMemo(
    () => filteredRecords.reduce((sum, r) => sum + r.order_amount, 0),
    [filteredRecords]
  );

  if (loading) {
    return <div className="p-6">Loading usage history...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Redemptions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{filteredRecords.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Discount Given</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">£{totalDiscountGiven.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">£{totalOrderValue.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Promo Code Usage History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, email, or reg..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Promo Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Customer Email</TableHead>
                  <TableHead>Vehicle Reg</TableHead>
                  <TableHead className="text-right">Order Amount</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead>Used At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No usage records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {record.code_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {record.code_type === "percentage"
                            ? `${record.code_value}%`
                            : `£${record.code_value}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{record.customer_email}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {record.vehicle_reg || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        £{record.order_amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        -£{record.discount_amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(record.used_at), "dd MMM yyyy, HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
