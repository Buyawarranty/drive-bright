import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Pencil, Trash2, Plus, Copy, Filter, Archive, RotateCcw, CalendarDays, Users, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface DiscountCode {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  valid_from: string;
  valid_to: string;
  usage_limit: number | null;
  used_count: number;
  active: boolean;
  archived: boolean;
  campaign_source: string | null;
  auto_archived_at: string | null;
  auto_archived_reason: string | null;
  stripe_coupon_id: string | null;
  stripe_promo_code_id: string | null;
  applicable_products: any;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface DiscountCodeFormData {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  valid_from: string;
  valid_to: string;
  usage_limit: number | null;
  campaign_source: string;
  active: boolean;
}

const CAMPAIGN_SOURCES = [
  { value: 'INSTA', label: 'Instagram' },
  { value: 'BILLO', label: 'UGC Platform' },
  { value: 'WELCOME', label: 'New Users' },
  { value: 'EMAIL', label: 'Email Campaign' },
  { value: 'INFLUENCER', label: 'Influencer' },
  { value: 'GENERAL', label: 'General Campaign' },
  { value: 'AFFILIATE', label: 'Affiliate' },
  { value: 'RETARGETING', label: 'Retargeting' },
];

export function DiscountCodesTab() {
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'valid_to' | 'used_count' | 'code'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [validityPeriod, setValidityPeriod] = useState<'6months' | '1month' | 'noend' | 'custom'>('noend');
  const [formData, setFormData] = useState<DiscountCodeFormData>({
    code: '',
    type: 'percentage',
    value: 0,
    valid_from: new Date().toISOString().split('T')[0],
    valid_to: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10 years (no end date)
    usage_limit: 1,
    campaign_source: 'GENERAL',
    active: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchDiscountCodes();
  }, []);

  const fetchDiscountCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDiscountCodes((data || []).map(item => ({
        ...item,
        type: item.type as 'percentage' | 'fixed'
      })));
    } catch (error) {
      console.error('Error fetching discount codes:', error);
      toast({
        title: "Error",
        description: "Failed to load discount codes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const autoExpireCodes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('auto-expire-discount-codes');
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: `${data.expiredCount} codes have been auto-archived`,
      });
      
      fetchDiscountCodes();
    } catch (error) {
      console.error('Error auto-expiring codes:', error);
      toast({
        title: "Error",
        description: "Failed to auto-expire codes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateAllToUnlimited = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('discount_codes')
        .update({ usage_limit: 1000000 })
        .neq('usage_limit', 1000000);
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "All discount codes updated to 1,000,000 usage limit",
      });
      
      fetchDiscountCodes();
    } catch (error) {
      console.error('Error updating codes:', error);
      toast({
        title: "Error",
        description: "Failed to update discount codes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);

      // Generate structured naming convention if not custom
      let finalCode = formData.code;
      if (!finalCode) {
        // Fun engaging words for discount codes
        const funWords = [
          'GOLDEN', 'UNLOCK', 'TRUSTED', 'NOW', 'GO', 'SAVE',
          'MAGIC', 'PRIME', 'VIP', 'EPIC', 'SUPER', 'MEGA',
          'FLASH', 'BOOST', 'POWER', 'ELITE', 'PREMIUM', 'HERO',
          'STAR', 'BRIGHT', 'SHINE', 'SPARK', 'GLOW', 'BLAZE'
        ];
        const randomWord = funWords[Math.floor(Math.random() * funWords.length)];
        finalCode = `${formData.campaign_source}${formData.value}${randomWord}`;
      }

      // Validate code format - Stripe only allows alphanumeric, hyphens, and underscores
      const codeRegex = /^[a-zA-Z0-9\-_]+$/;
      if (!codeRegex.test(finalCode)) {
        toast({
          title: "Invalid code format",
          description: "Discount codes can only contain letters, numbers, hyphens (-), and underscores (_). Special characters like %, $, @ are not allowed.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Convert date strings to ISO timestamps
      const validFromDate = new Date(formData.valid_from);
      validFromDate.setHours(0, 0, 0, 0);
      
      const validToDate = new Date(formData.valid_to);
      validToDate.setHours(23, 59, 59, 999);

      const submitData = {
        ...formData,
        code: finalCode,
        valid_from: validFromDate.toISOString(),
        valid_to: validToDate.toISOString()
      };

      if (editingCode) {
        // Update existing code
        const { error } = await supabase
          .from('discount_codes')
          .update({
            code: submitData.code,
            type: submitData.type,
            value: submitData.value,
            valid_from: submitData.valid_from,
            valid_to: submitData.valid_to,
            usage_limit: submitData.usage_limit,
            campaign_source: submitData.campaign_source,
            active: submitData.active,
          })
          .eq('id', editingCode.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Discount code updated successfully",
        });
      } else {
        // Create new code - use edge function to handle Stripe integration
        const { data, error } = await supabase.functions.invoke('create-discount-code', {
          body: submitData
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Discount code created successfully",
        });
      }

      resetForm();
      fetchDiscountCodes();
    } catch (error: any) {
      console.error('Error saving discount code:', error);
      const errorMessage = error?.message || error?.error || "Failed to save discount code";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke('delete-discount-code', {
        body: { id }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Discount code deleted successfully",
      });

      fetchDiscountCodes();
    } catch (error) {
      console.error('Error deleting discount code:', error);
      toast({
        title: "Error",
        description: "Failed to delete discount code",
        variant: "destructive",
      });
    }
  };

  const handleArchive = async (code: DiscountCode) => {
    try {
      const { error } = await supabase
        .from('discount_codes')
        .update({ 
          archived: !code.archived,
          auto_archived_at: !code.archived ? new Date().toISOString() : null,
          auto_archived_reason: !code.archived ? 'Manually archived' : null
        })
        .eq('id', code.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Discount code ${!code.archived ? 'archived' : 'unarchived'}`,
      });

      fetchDiscountCodes();
    } catch (error) {
      console.error('Error archiving discount code:', error);
      toast({
        title: "Error",
        description: "Failed to archive discount code",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (code: DiscountCode) => {
    try {
      const { error } = await supabase
        .from('discount_codes')
        .update({ active: !code.active })
        .eq('id', code.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Discount code ${!code.active ? 'activated' : 'deactivated'}`,
      });

      fetchDiscountCodes();
    } catch (error) {
      console.error('Error updating discount code:', error);
      toast({
        title: "Error",
        description: "Failed to update discount code",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setValidityPeriod('noend');
    setFormData({
      code: '',
      type: 'percentage',
      value: 0,
      valid_from: new Date().toISOString().split('T')[0],
      valid_to: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10 years (no end date)
      usage_limit: 1,
      campaign_source: 'GENERAL',
      active: true,
    });
    setEditingCode(null);
    setIsCreateOpen(false);
  };

  const handleEdit = (code: DiscountCode) => {
    setFormData({
      code: code.code,
      type: code.type,
      value: code.value,
      valid_from: code.valid_from.split('T')[0],
      valid_to: code.valid_to.split('T')[0],
      usage_limit: code.usage_limit,
      campaign_source: code.campaign_source || 'GENERAL',
      active: code.active,
    });
    setEditingCode(code);
    setIsCreateOpen(true);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied",
      description: "Discount code copied to clipboard",
    });
  };

  const generateStructuredCode = (source: string, value: number) => {
    // Fun engaging words for discount codes
    const funWords = [
      'GOLDEN', 'UNLOCK', 'TRUSTED', 'NOW', 'GO', 'SAVE',
      'MAGIC', 'PRIME', 'VIP', 'EPIC', 'SUPER', 'MEGA',
      'FLASH', 'BOOST', 'POWER', 'ELITE', 'PREMIUM', 'HERO',
      'STAR', 'BRIGHT', 'SHINE', 'SPARK', 'GLOW', 'BLAZE'
    ];
    const randomWord = funWords[Math.floor(Math.random() * funWords.length)];
    return `${source}${value}${randomWord}`;
  };

  const handleValidityPeriodChange = (period: '6months' | '1month' | 'noend' | 'custom') => {
    setValidityPeriod(period);
    
    if (period !== 'custom') {
      const validFromDate = new Date(formData.valid_from);
      let validToDate = new Date(validFromDate);
      
      if (period === '6months') {
        validToDate.setMonth(validToDate.getMonth() + 6);
      } else if (period === '1month') {
        validToDate.setMonth(validToDate.getMonth() + 1);
      } else if (period === 'noend') {
        validToDate = new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000); // 10 years in the future
      }
      
      setFormData({
        ...formData,
        valid_to: validToDate.toISOString().split('T')[0]
      });
    }
  };

  const handleValidFromChange = (dateString: string) => {
    setFormData({ ...formData, valid_from: dateString });
    
    // Auto-update valid_to if not custom
    if (validityPeriod !== 'custom') {
      const validFromDate = new Date(dateString);
      let validToDate = new Date(validFromDate);
      
      if (validityPeriod === '6months') {
        validToDate.setMonth(validToDate.getMonth() + 6);
      } else if (validityPeriod === '1month') {
        validToDate.setMonth(validToDate.getMonth() + 1);
      } else if (validityPeriod === 'noend') {
        validToDate = new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000); // 10 years in the future
      }
      
      setFormData({
        ...formData,
        valid_from: dateString,
        valid_to: validToDate.toISOString().split('T')[0]
      });
    }
  };

  const handleCampaignSourceChange = (source: string) => {
    setFormData({ 
      ...formData, 
      campaign_source: source,
      code: generateStructuredCode(source, formData.value)
    });
  };

  const handleValueChange = (value: number) => {
    setFormData({ 
      ...formData, 
      value,
      code: generateStructuredCode(formData.campaign_source, value)
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setIsSelectAll(checked);
    const filteredCodes = getFilteredCodes();
    if (checked) {
      setSelectedCodes(new Set(filteredCodes.map(code => code.id)));
    } else {
      setSelectedCodes(new Set());
    }
  };

  const handleSelectCode = (codeId: string, checked: boolean) => {
    const newSelected = new Set(selectedCodes);
    if (checked) {
      newSelected.add(codeId);
    } else {
      newSelected.delete(codeId);
    }
    setSelectedCodes(newSelected);
    const filteredCodes = getFilteredCodes();
    setIsSelectAll(newSelected.size === filteredCodes.length);
  };

  const handleBulkDelete = async () => {
    if (selectedCodes.size === 0) return;

    try {
      setLoading(true);
      
      // Delete all selected codes
      for (const codeId of selectedCodes) {
        await supabase.functions.invoke('delete-discount-code', {
          body: { id: codeId }
        });
      }

      toast({
        title: "Success",
        description: `${selectedCodes.size} discount code(s) deleted successfully`,
      });

      setSelectedCodes(new Set());
      setIsSelectAll(false);
      fetchDiscountCodes();
    } catch (error) {
      console.error('Error deleting discount codes:', error);
      toast({
        title: "Error",
        description: "Failed to delete discount codes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkArchive = async () => {
    if (selectedCodes.size === 0) return;

    try {
      setLoading(true);
      
      // Archive all selected codes
      const { error } = await supabase
        .from('discount_codes')
        .update({ 
          archived: true,
          auto_archived_at: new Date().toISOString(),
          auto_archived_reason: 'Bulk archived'
        })
        .in('id', Array.from(selectedCodes));

      if (error) throw error;

      toast({
        title: "Success",
        description: `${selectedCodes.size} discount code(s) archived successfully`,
      });

      setSelectedCodes(new Set());
      setIsSelectAll(false);
      fetchDiscountCodes();
    } catch (error) {
      console.error('Error archiving discount codes:', error);
      toast({
        title: "Error",
        description: "Failed to archive discount codes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFilteredCodes = () => {
    let filtered = discountCodes.filter(code => {
      // Tab filter
      if (activeTab === 'active' && code.archived) return false;
      if (activeTab === 'archived' && !code.archived) return false;
      
      // Search filter
      if (searchTerm && !code.code.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      // Source filter
      if (filterSource !== 'all' && code.campaign_source !== filterSource) return false;
      
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'code':
          aVal = a.code;
          bVal = b.code;
          break;
        case 'valid_to':
          aVal = new Date(a.valid_to);
          bVal = new Date(b.valid_to);
          break;
        case 'used_count':
          aVal = a.used_count;
          bVal = b.used_count;
          break;
        default:
          aVal = new Date(a.created_at);
          bVal = new Date(b.created_at);
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  };

  const getStatusBadge = (code: DiscountCode) => {
    const now = new Date();
    const expiryDate = new Date(code.valid_to);
    const isExpired = expiryDate < now;
    const isUsageLimitReached = code.usage_limit && code.used_count >= code.usage_limit;
    
    if (code.archived) {
      return <Badge variant="secondary">Archived</Badge>;
    }
    if (!code.active) {
      return <Badge variant="outline">Inactive</Badge>;
    }
    if (isExpired) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (isUsageLimitReached) {
      return <Badge variant="destructive">Limit Reached</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  if (loading && discountCodes.length === 0) {
    return <div className="p-6">Loading discount codes...</div>;
  }

  const filteredCodes = getFilteredCodes();
  const activeCodes = discountCodes.filter(code => !code.archived);
  const archivedCodes = discountCodes.filter(code => code.archived);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Discount Codes</h2>
          <p className="text-muted-foreground">
            Manage discount codes for warranty packages with structured naming and auto-expiry
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={autoExpireCodes} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Auto-Expire
          </Button>
          
          <Button variant="outline" onClick={updateAllToUnlimited} disabled={loading}>
            Set All to 1M Limit
          </Button>
          
          {selectedCodes.size > 0 && (
            <>
              <Button variant="outline" onClick={handleBulkArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Archive Selected ({selectedCodes.size})
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedCodes.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-white z-50">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Selected Discount Codes</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {selectedCodes.size} discount code(s)? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete} className="bg-red-500 hover:bg-red-600">
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Create Code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingCode ? 'Edit Discount Code' : 'Create Discount Code'}
                </DialogTitle>
                <DialogDescription>
                  {editingCode ? 'Update the discount code details' : 'Create a new discount code with structured naming'}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign_source">Campaign Source</Label>
                  <Select value={formData.campaign_source} onValueChange={handleCampaignSourceChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border shadow-lg z-50">
                      {CAMPAIGN_SOURCES.map(source => (
                        <SelectItem key={source.value} value={source.value}>
                          {source.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select value={formData.type} onValueChange={(value: 'percentage' | 'fixed') => setFormData({ ...formData, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border shadow-lg z-50">
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="value">Value</Label>
                    <div className="relative">
                     <Input
                       id="value"
                       type="number"
                       value={formData.value || ''}
                       onChange={(e) => handleValueChange(e.target.value ? parseFloat(e.target.value) : 0)}
                       placeholder={formData.type === 'percentage' ? '25' : '50'}
                       min="0"
                       max={formData.type === 'percentage' ? '100' : undefined}
                       step="0.01"
                       required
                     />
                      {formData.type === 'percentage' && (
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
                      )}
                      {formData.type === 'fixed' && (
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">£</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">Code (Auto-generated)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => {
                        // Only allow alphanumeric, hyphens, and underscores
                        const sanitized = e.target.value.toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
                        setFormData({ ...formData, code: sanitized });
                      }}
                      placeholder="Will auto-generate if empty"
                      className="flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setFormData({ 
                        ...formData, 
                        code: generateStructuredCode(formData.campaign_source, formData.value) 
                      })}
                    >
                      Generate
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Only letters, numbers, hyphens (-), and underscores (_) allowed
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="valid_from">Valid From</Label>
                    <Input
                      id="valid_from"
                      type="date"
                      value={formData.valid_from}
                      onChange={(e) => handleValidFromChange(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Validity Period</Label>
                    <Select value={validityPeriod} onValueChange={(value: '6months' | '1month' | 'noend' | 'custom') => handleValidityPeriodChange(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border shadow-lg z-50">
                        <SelectItem value="noend">No End Date (Default)</SelectItem>
                        <SelectItem value="6months">6 Months</SelectItem>
                        <SelectItem value="1month">1 Month</SelectItem>
                        <SelectItem value="custom">Custom End Date</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {validityPeriod === 'custom' && (
                    <div className="space-y-2">
                      <Label htmlFor="valid_to">Valid To</Label>
                      <Input
                        id="valid_to"
                        type="date"
                        value={formData.valid_to}
                        onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  {validityPeriod !== 'custom' && (
                    <div className="text-sm text-muted-foreground">
                      Valid until: {new Date(formData.valid_to).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="usage_limit">Allow these codes to be used indefinitely</Label>
                  <Input
                    id="usage_limit"
                    type="number"
                    value={formData.usage_limit || ''}
                    onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Leave empty for unlimited (not recommended)"
                    min="1"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  />
                  <Label htmlFor="active">Active</Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {editingCode ? 'Update Code' : 'Create Code'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label>Search Codes</Label>
              <Input
                placeholder="Search by code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="min-w-[150px]">
              <Label>Campaign Source</Label>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-lg z-50">
                  <SelectItem value="all">All Sources</SelectItem>
                  {CAMPAIGN_SOURCES.map(source => (
                    <SelectItem key={source.value} value={source.value}>
                      {source.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="min-w-[120px]">
              <Label>Sort By</Label>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-lg z-50">
                  <SelectItem value="created_at">Created Date</SelectItem>
                  <SelectItem value="valid_to">Expiry Date</SelectItem>
                  <SelectItem value="used_count">Usage Count</SelectItem>
                  <SelectItem value="code">Code A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="min-w-[100px]">
              <Label>Order</Label>
              <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-lg z-50">
                  <SelectItem value="desc">Newest First</SelectItem>
                  <SelectItem value="asc">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Active/Archived */}
      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
        <TabsList>
          <TabsTrigger value="active" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Active Codes ({activeCodes.length})
          </TabsTrigger>
          <TabsTrigger value="archived" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Archived Codes ({archivedCodes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Discount Codes</CardTitle>
              <CardDescription>
                Currently active discount codes available for use
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isSelectAll}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No discount codes found matching your filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCodes.map((code) => (
                      <TableRow key={code.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCodes.has(code.id)}
                            onCheckedChange={(checked) => handleSelectCode(code.id, checked as boolean)}
                            aria-label={`Select ${code.code}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">{code.code}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyCode(code.code)}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {code.campaign_source && (
                            <Badge variant="outline">
                              {CAMPAIGN_SOURCES.find(s => s.value === code.campaign_source)?.label || code.campaign_source}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{code.type === 'percentage' ? 'Percentage' : 'Fixed'}</TableCell>
                        <TableCell>
                          {code.type === 'percentage' ? `${code.value}%` : `£${code.value}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(code.valid_to), 'MMM dd, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {code.used_count}{code.usage_limit ? `/${code.usage_limit}` : ''}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(code)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(code)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchive(code)}
                              className="h-8 w-8 p-0"
                            >
                              <Archive className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-white z-50">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Discount Code</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the discount code "{code.code}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDelete(code.id)}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived">
          <Card>
            <CardHeader>
              <CardTitle>Archived Discount Codes</CardTitle>
              <CardDescription>
                Previously active codes that have been archived or auto-expired
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Archived Reason</TableHead>
                    <TableHead>Archived Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No archived discount codes found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCodes.map((code) => (
                      <TableRow key={code.id}>
                        <TableCell>
                          <span className="font-mono font-semibold text-muted-foreground">{code.code}</span>
                        </TableCell>
                        <TableCell>
                          {code.campaign_source && (
                            <Badge variant="outline">
                              {CAMPAIGN_SOURCES.find(s => s.value === code.campaign_source)?.label || code.campaign_source}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {code.type === 'percentage' ? `${code.value}%` : `£${code.value}`}
                        </TableCell>
                        <TableCell>
                          {code.used_count}{code.usage_limit ? `/${code.usage_limit}` : ''}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {code.auto_archived_reason || 'Manually archived'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {code.auto_archived_at && format(new Date(code.auto_archived_at), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchive(code)}
                              className="h-8 w-8 p-0"
                              title="Unarchive"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-white z-50">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Archived Code</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to permanently delete the archived discount code "{code.code}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDelete(code.id)}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    Delete Permanently
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}