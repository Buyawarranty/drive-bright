import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Shield, AlertTriangle, Eye, Ban, BarChart3 } from 'lucide-react';

interface ClickFraudRecord {
  id: string;
  ip_address: string;
  user_agent: string;
  action_type: string;
  click_count: number;
  is_suspicious: boolean;
  risk_score: number;
  created_at: string;
  blocked_reason?: string;
  session_id?: string;
  updated_at: string;
}

interface BlockedIP {
  id: string;
  ip_address: string;
  blocked_at: string;
  blocked_until?: string;
  reason: string;
  created_by: string;
}

interface RateLimit {
  id: string;
  identifier: string;
  action_type: string;
  request_count: number;
  window_start: string;
}

export function ClickFraudTab() {
  const [fraudRecords, setFraudRecords] = useState<ClickFraudRecord[]>([]);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClicks: 0,
    suspiciousClicks: 0,
    blockedIPs: 0,
    highRiskClicks: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchClickFraudData();
  }, []);

  const fetchClickFraudData = async () => {
    setLoading(true);
    try {
      // Fetch fraud records
      const { data: fraudData, error: fraudError } = await supabase
        .from('click_fraud_protection')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (fraudError) throw fraudError;
      setFraudRecords(fraudData as ClickFraudRecord[] || []);

      // Fetch blocked IPs
      const { data: blockedData, error: blockedError } = await supabase
        .from('blocked_ips')
        .select('*')
        .order('blocked_at', { ascending: false });

      if (blockedError) throw blockedError;
      setBlockedIPs(blockedData as BlockedIP[] || []);

      // Fetch rate limits
      const { data: rateLimitData, error: rateLimitError } = await supabase
        .from('rate_limits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (rateLimitError) throw rateLimitError;
      setRateLimits(rateLimitData || []);

      // Calculate stats
      const totalClicks = fraudData?.reduce((sum, record) => sum + record.click_count, 0) || 0;
      const suspiciousClicks = fraudData?.filter(r => r.is_suspicious).length || 0;
      const highRiskClicks = fraudData?.filter(r => r.risk_score > 70).length || 0;

      setStats({
        totalClicks,
        suspiciousClicks,
        blockedIPs: blockedData?.length || 0,
        highRiskClicks
      });

    } catch (error) {
      console.error('Error fetching click fraud data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load click fraud protection data"
      });
    } finally {
      setLoading(false);
    }
  };

  const unblockIP = async (ipAddress: string) => {
    try {
      const { error } = await supabase
        .from('blocked_ips')
        .delete()
        .eq('ip_address', ipAddress);

      if (error) throw error;

      toast({
        title: "Success",
        description: `IP ${ipAddress} has been unblocked`
      });
      
      fetchClickFraudData();
    } catch (error) {
      console.error('Error unblocking IP:', error);
      toast({
        variant: "destructive",
        title: "Error", 
        description: "Failed to unblock IP address"
      });
    }
  };

  const getRiskBadgeColor = (riskScore: number) => {
    if (riskScore >= 80) return "destructive";
    if (riskScore >= 60) return "default";
    if (riskScore >= 40) return "secondary";
    return "outline";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return <div className="p-4">Loading click fraud protection data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClicks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspicious Clicks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.suspiciousClicks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk Clicks</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.highRiskClicks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked IPs</CardTitle>
            <Ban className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.blockedIPs}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="fraud-records" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fraud-records">Click Records</TabsTrigger>
          <TabsTrigger value="blocked-ips">Blocked IPs</TabsTrigger>
          <TabsTrigger value="rate-limits">Rate Limits</TabsTrigger>
        </TabsList>

        <TabsContent value="fraud-records">
          <Card>
            <CardHeader>
              <CardTitle>Click Fraud Records</CardTitle>
              <CardDescription>
                Recent click activity and fraud detection results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fraudRecords.map((record) => (
                  <div key={record.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{record.ip_address}</span>
                        <Badge variant={getRiskBadgeColor(record.risk_score)}>
                          Risk: {record.risk_score}
                        </Badge>
                        {record.is_suspicious && (
                          <Badge variant="destructive">Suspicious</Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(record.created_at)}
                      </span>
                    </div>
                    <div className="text-sm space-y-1">
                      <div><strong>Action:</strong> {record.action_type}</div>
                      <div><strong>Click Count:</strong> {record.click_count}</div>
                      <div><strong>User Agent:</strong> {record.user_agent?.substring(0, 80)}...</div>
                    </div>
                  </div>
                ))}
                
                {fraudRecords.length === 0 && (
                  <Alert>
                    <Eye className="h-4 w-4" />
                    <AlertDescription>
                      No click fraud records found. The system is monitoring and will display activity here.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked-ips">
          <Card>
            <CardHeader>
              <CardTitle>Blocked IP Addresses</CardTitle>
              <CardDescription>
                IPs that have been automatically or manually blocked
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {blockedIPs.map((blocked) => (
                  <div key={blocked.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{blocked.ip_address}</span>
                          <Badge variant="destructive">Blocked</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div><strong>Reason:</strong> {blocked.reason}</div>
                          <div><strong>Blocked:</strong> {formatDate(blocked.blocked_at)}</div>
                          {blocked.blocked_until && (
                            <div><strong>Until:</strong> {formatDate(blocked.blocked_until)}</div>
                          )}
                          <div><strong>By:</strong> {blocked.created_by}</div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unblockIP(blocked.ip_address)}
                      >
                        Unblock
                      </Button>
                    </div>
                  </div>
                ))}
                
                {blockedIPs.length === 0 && (
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      No IPs are currently blocked. The system will automatically block suspicious IPs.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rate-limits">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limit Activity</CardTitle>
              <CardDescription>
                Recent rate limiting activity by IP and action type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rateLimits.map((limit) => (
                  <div key={limit.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{limit.identifier}</span>
                          <Badge variant="outline">{limit.action_type}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <strong>Requests:</strong> {limit.request_count} | 
                          <strong> Window:</strong> {formatDate(limit.window_start)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {rateLimits.length === 0 && (
                  <Alert>
                    <BarChart3 className="h-4 w-4" />
                    <AlertDescription>
                      No rate limiting data available. Activity will appear here as users interact with the system.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-end">
        <Button onClick={fetchClickFraudData} variant="outline">
          Refresh Data
        </Button>
      </div>
    </div>
  );
}