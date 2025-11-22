
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Save, X, Upload, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import DocumentUpload from './DocumentUpload';

interface SpecialPlan {
  id: string;
  vehicle_type: string;
  name: string;
  monthly_price: number;
  yearly_price: number | null;
  two_yearly_price: number | null;
  three_yearly_price: number | null;
  coverage: string[];
  is_active: boolean;
  pricing_matrix: any;
}

const SpecialVehiclePlansTab = () => {
  const [plans, setPlans] = useState<SpecialPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<SpecialPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [coverageText, setCoverageText] = useState('');
  const [showPricingMatrix, setShowPricingMatrix] = useState(false);
  const { toast } = useToast();

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('special_vehicle_plans')
        .select('*')
        .order('vehicle_type');

      if (error) throw error;

      // Convert JSON coverage to string arrays
      const plansWithCoverage = data?.map(plan => ({
        ...plan,
        coverage: Array.isArray(plan.coverage) ? plan.coverage : []
      })) || [];

      setPlans(plansWithCoverage as SpecialPlan[]);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast({
        title: "Error",
        description: "Failed to fetch special vehicle plans",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleEdit = (plan: SpecialPlan) => {
    setEditingPlan(plan);
    setCoverageText(plan.coverage.join('\n'));
  };

  const updatePricingMatrix = (period: string, excess: string, field: string, value: number) => {
    if (!editingPlan) return;
    
    const matrix = editingPlan.pricing_matrix || {};
    const updatedMatrix = {
      ...matrix,
      [period]: {
        ...(matrix[period] || {}),
        [excess]: {
          ...(matrix[period]?.[excess] || {}),
          [field]: value
        }
      }
    };
    
    setEditingPlan({
      ...editingPlan,
      pricing_matrix: updatedMatrix
    });
  };

  const getPricingValue = (period: string, excess: string, field: string): number => {
    if (!editingPlan?.pricing_matrix) return 0;
    return editingPlan.pricing_matrix[period]?.[excess]?.[field] || 0;
  };

  const handleSave = async () => {
    if (!editingPlan) return;

    try {
      const coverageArray = coverageText.split('\n').filter(item => item.trim() !== '');
      
      const { error } = await supabase
        .from('special_vehicle_plans')
        .update({
          name: editingPlan.name,
          monthly_price: editingPlan.monthly_price,
          yearly_price: editingPlan.yearly_price,
          two_yearly_price: editingPlan.two_yearly_price,
          three_yearly_price: editingPlan.three_yearly_price,
          coverage: coverageArray,
          is_active: editingPlan.is_active,
          pricing_matrix: editingPlan.pricing_matrix
        })
        .eq('id', editingPlan.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Plan updated successfully",
      });

      setEditingPlan(null);
      setCoverageText('');
      setShowPricingMatrix(false);
      fetchPlans();
    } catch (error) {
      console.error('Error updating plan:', error);
      toast({
        title: "Error",
        description: "Failed to update plan",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setEditingPlan(null);
    setCoverageText('');
    setShowPricingMatrix(false);
  };


  if (loading) {
    return <div className="text-center py-4">Loading special vehicle plans...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Special Vehicle Plans</h2>
      </div>

      <DocumentUpload />

      <div className="grid gap-6">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {plan.name}
                  <span className="text-sm font-normal bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {plan.vehicle_type}
                  </span>
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {editingPlan?.id === plan.id ? (
                  <div className="flex gap-2">
                    <Button onClick={handleSave} size="sm">
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button onClick={handleCancel} variant="outline" size="sm">
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => handleEdit(plan)} variant="outline" size="sm">
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingPlan?.id === plan.id ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Plan Name</Label>
                      <Input
                        id="name"
                        value={editingPlan.name}
                        onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="monthly_price">Monthly Price (£)</Label>
                      <Input
                        id="monthly_price"
                        type="number"
                        step="0.01"
                        value={editingPlan.monthly_price}
                        onChange={(e) => setEditingPlan({ ...editingPlan, monthly_price: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="yearly_price">Yearly Price (£)</Label>
                      <Input
                        id="yearly_price"
                        type="number"
                        step="0.01"
                        value={editingPlan.yearly_price || ''}
                        onChange={(e) => setEditingPlan({ 
                          ...editingPlan, 
                          yearly_price: e.target.value ? parseFloat(e.target.value) : null 
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="two_yearly_price">2-Year Price (£)</Label>
                      <Input
                        id="two_yearly_price"
                        type="number"
                        step="0.01"
                        value={editingPlan.two_yearly_price || ''}
                        onChange={(e) => setEditingPlan({ 
                          ...editingPlan, 
                          two_yearly_price: e.target.value ? parseFloat(e.target.value) : null 
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="three_yearly_price">3-Year Price (£)</Label>
                      <Input
                        id="three_yearly_price"
                        type="number"
                        step="0.01"
                        value={editingPlan.three_yearly_price || ''}
                        onChange={(e) => setEditingPlan({ 
                          ...editingPlan, 
                          three_yearly_price: e.target.value ? parseFloat(e.target.value) : null 
                        })}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <Button
                      onClick={() => setShowPricingMatrix(!showPricingMatrix)}
                      variant="outline"
                      size="sm"
                      className="text-purple-600 border-purple-300 hover:bg-purple-50"
                    >
                      {showPricingMatrix ? 'Hide' : 'Show'} Pricing Matrix
                    </Button>
                  </div>

                  {showPricingMatrix && (
                    <div className="space-y-6 border rounded-lg p-4 bg-gray-50">
                      <h4 className="font-bold text-lg text-gray-900">Pricing Matrix (by Payment Period & Voluntary Excess)</h4>
                      
                      {['yearly', 'two_yearly', 'three_yearly'].map((period) => (
                        <div key={period} className="space-y-3">
                          <h5 className="font-semibold text-md capitalize text-gray-800">
                            {period.replace('_', ' ')} Pricing
                          </h5>
                          <div className="grid grid-cols-5 gap-3">
                            {['0', '50', '100', '150', '200'].map((excess) => (
                              <div key={excess} className="bg-white p-3 rounded border">
                                <div className="text-sm font-medium text-gray-600 mb-2">£{excess} Excess</div>
                                <div className="space-y-2">
                                  <div>
                                    <label className="text-xs text-gray-500">Monthly £</label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={getPricingValue(period, excess, 'monthly')}
                                      onChange={(e) => updatePricingMatrix(period, excess, 'monthly', parseFloat(e.target.value) || 0)}
                                      className="text-xs h-8"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="coverage">Coverage (one item per line)</Label>
                    <Textarea
                      id="coverage"
                      value={coverageText}
                      onChange={(e) => setCoverageText(e.target.value)}
                      rows={10}
                      placeholder="Enter coverage items, one per line"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_active"
                      checked={editingPlan.is_active}
                      onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, is_active: checked })}
                    />
                    <Label htmlFor="is_active">Active</Label>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <strong>Monthly:</strong> £{plan.monthly_price}
                    </div>
                    <div>
                      <strong>Yearly:</strong> {plan.yearly_price ? `£${plan.yearly_price}` : 'N/A'}
                    </div>
                    <div>
                      <strong>2-Year:</strong> {plan.two_yearly_price ? `£${plan.two_yearly_price}` : 'N/A'}
                    </div>
                    <div>
                      <strong>3-Year:</strong> {plan.three_yearly_price ? `£${plan.three_yearly_price}` : 'N/A'}
                    </div>
                  </div>
                  
                  <div>
                    <strong>Status:</strong> {plan.is_active ? 'Active' : 'Inactive'}
                  </div>
                  
                  <div>
                    <strong>Coverage:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {plan.coverage.map((item, index) => (
                        <li key={index} className="text-sm">{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SpecialVehiclePlansTab;
