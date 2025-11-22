import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Edit, Save, Plus, Trash2 } from 'lucide-react';
import { Json } from '@/integrations/supabase/types';
import DocumentUpload from './DocumentUpload';
import TermsConditionsUpload from './TermsConditionsUpload';

interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price: number;
  two_yearly_price: number;
  three_yearly_price: number;
  coverage: Json;
  add_ons: Json;
  is_active: boolean;
  pricing_matrix: Json;
}

interface PricingMatrix {
  yearly: ExcessPricing;
  two_yearly: ExcessPricing;
  three_yearly: ExcessPricing;
}

interface ExcessPricing {
  0: { monthly: number; total: number; save: number };
  50: { monthly: number; total: number; save: number };
  100: { monthly: number; total: number; save: number };
  150: { monthly: number; total: number; save: number };
  200: { monthly: number; total: number; save: number };
}

// Correct plan features that match the PricingTable component
const defaultPlanFeatures = {
  basic: [
    'Mechanical Breakdown Protection',
    'Labour up to £35 p/hr',
    '10 Claims per year',
    'Engine',
    'Manual Gearbox',
    'Automatic Transmission',
    'Torque Convertor',
    'Overdrive',
    'Differential',
    'Electrics',
    'Casings'
  ],
  gold: [
    'Labour up to £75 p/hr',
    '*FREE Halfords MOT test',
    '*Unlimited Claims',
    'Engine',
    'Manual Gearbox',
    'Automatic Transmission',
    'Torque Converter',
    'Overdrive',
    'Differential',
    'Electrics',
    'Casings',
    'Recovery Claim-Back',
    'Basic plan plus:',
    'Clutch',
    'Cooling System',
    'Fuel System',
    'Braking System',
    'Propshaft',
    'Vehicle Hire',
    'European Cover'
  ],
  platinum: [
    'Mechanical & Electrical Breakdown',
    'Labour up to £100 p/hr',
    'Halfords MOT test',
    'Unlimited Claims',
    'Engine',
    'Turbo Unit',
    'Manual Gearbox',
    'Automatic Transmission',
    'Clutch',
    'Differential',
    'Drive Shafts',
    'Brakes',
    'Steering',
    'Suspension',
    'Bearings',
    'Cooling System',
    'Ventilation',
    'ECU',
    'Electrics',
    'Fuel System',
    'Air Conditioning',
    'Locks',
    'Seals',
    'Casings',
    'Vehicle Hire',
    'Recovery Claim-Back',
    'European Cover'
  ]
};

// Correct add-ons that match the PricingTable component
const defaultAddOns = {
  basic: ['Power Hood', 'ECU', 'Air Conditioning', 'Turbo'],
  gold: ['Power Hood', 'ECU', 'Air Conditioning', 'Turbo'],
  platinum: ['Power Hood']
};

export const PlansTab = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [newCoverageItem, setNewCoverageItem] = useState('');
  const [newAddOnItem, setNewAddOnItem] = useState('');
  const [showPricingMatrix, setShowPricingMatrix] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('monthly_price', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const initializePlanFeatures = (planName: string) => {
    const planKey = planName.toLowerCase() as keyof typeof defaultPlanFeatures;
    return {
      coverage: defaultPlanFeatures[planKey] || [],
      add_ons: defaultAddOns[planKey] || []
    };
  };

  const savePlan = async (plan: Plan) => {
    try {
      const { error } = await supabase
        .from('plans')
        .update({
          name: plan.name,
          monthly_price: plan.monthly_price,
          yearly_price: plan.yearly_price,
          two_yearly_price: plan.two_yearly_price,
          three_yearly_price: plan.three_yearly_price,
          coverage: plan.coverage,
          add_ons: plan.add_ons,
          is_active: plan.is_active,
          pricing_matrix: plan.pricing_matrix
        })
        .eq('id', plan.id);

      if (error) throw error;
      
      fetchPlans();
      setEditingPlan(null);
      setShowPricingMatrix(false);
      toast.success('Plan updated successfully');
    } catch (error) {
      console.error('Error updating plan:', error);
      toast.error('Failed to update plan');
    }
  };

  const resetToDefaults = async (planName: string) => {
    if (!editingPlan) return;
    
    const defaults = initializePlanFeatures(planName);
    const updatedPlan = {
      ...editingPlan,
      coverage: defaults.coverage,
      add_ons: defaults.add_ons
    };
    
    // Save to database immediately
    try {
      const { error } = await supabase
        .from('plans')
        .update({
          coverage: defaults.coverage,
          add_ons: defaults.add_ons
        })
        .eq('id', editingPlan.id);

      if (error) throw error;
      
      setEditingPlan(updatedPlan);
      fetchPlans(); // Refresh the plans list
      toast.success(`Reset ${planName} to default features and saved to database`);
    } catch (error) {
      console.error('Error resetting plan features:', error);
      toast.error('Failed to reset plan features');
    }
  };

  const addCoverageItem = () => {
    if (!newCoverageItem.trim() || !editingPlan) return;
    
    const currentCoverage = Array.isArray(editingPlan.coverage) ? editingPlan.coverage : [];
    setEditingPlan({
      ...editingPlan,
      coverage: [...currentCoverage, newCoverageItem.trim()]
    });
    setNewCoverageItem('');
  };

  const removeCoverageItem = (index: number) => {
    if (!editingPlan) return;
    
    const currentCoverage = Array.isArray(editingPlan.coverage) ? editingPlan.coverage : [];
    setEditingPlan({
      ...editingPlan,
      coverage: currentCoverage.filter((_, i) => i !== index)
    });
  };

  const updateCoverageItem = (index: number, newValue: string) => {
    if (!editingPlan) return;
    
    const currentCoverage = Array.isArray(editingPlan.coverage) ? editingPlan.coverage : [];
    const updatedCoverage = [...currentCoverage];
    updatedCoverage[index] = newValue;
    setEditingPlan({
      ...editingPlan,
      coverage: updatedCoverage
    });
  };

  const addAddOnItem = () => {
    if (!newAddOnItem.trim() || !editingPlan) return;
    
    const currentAddOns = Array.isArray(editingPlan.add_ons) ? editingPlan.add_ons : [];
    setEditingPlan({
      ...editingPlan,
      add_ons: [...currentAddOns, newAddOnItem.trim()]
    });
    setNewAddOnItem('');
  };

  const removeAddOnItem = (index: number) => {
    if (!editingPlan) return;
    
    const currentAddOns = Array.isArray(editingPlan.add_ons) ? editingPlan.add_ons : [];
    setEditingPlan({
      ...editingPlan,
      add_ons: currentAddOns.filter((_, i) => i !== index)
    });
  };

  const updateAddOnItem = (index: number, newValue: string) => {
    if (!editingPlan) return;
    
    const currentAddOns = Array.isArray(editingPlan.add_ons) ? editingPlan.add_ons : [];
    const updatedAddOns = [...currentAddOns];
    updatedAddOns[index] = newValue;
    setEditingPlan({
      ...editingPlan,
      add_ons: updatedAddOns
    });
  };

  const updatePricingMatrix = (period: string, excess: string, field: string, value: number) => {
    if (!editingPlan || !editingPlan.pricing_matrix) return;
    
    const matrix = typeof editingPlan.pricing_matrix === 'object' ? editingPlan.pricing_matrix as any : {};
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
    const matrix = typeof editingPlan.pricing_matrix === 'object' ? editingPlan.pricing_matrix as any : {};
    return matrix[period]?.[excess]?.[field] || 0;
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading plans...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Plans Management</h2>
        <p className="text-sm text-gray-600">Manage all pricing and features for each plan</p>
      </div>

      <DocumentUpload />
      
      <TermsConditionsUpload />

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const coverageArray = Array.isArray(plan.coverage) ? plan.coverage : [];
          const addOnsArray = Array.isArray(plan.add_ons) ? plan.add_ons : [];
          
          return (
            <Card key={plan.id} className="relative">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="mt-2 space-y-1">
                      <p className="text-lg font-bold text-orange-600">
                        £{plan.monthly_price}/month
                      </p>
                      {plan.yearly_price && (
                        <p className="text-sm text-gray-600">
                          £{plan.yearly_price}/year
                        </p>
                      )}
                      {plan.two_yearly_price && (
                        <p className="text-sm text-gray-600">
                          £{plan.two_yearly_price}/2 years
                        </p>
                      )}
                      {plan.three_yearly_price && (
                        <p className="text-sm text-gray-600">
                          £{plan.three_yearly_price}/3 years
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingPlan(plan)}
                          className="hover:bg-orange-50"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Edit {plan.name} Plan</DialogTitle>
                        </DialogHeader>
                        
                        {editingPlan && (
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium mb-2">Plan Name</label>
                                <Input
                                  value={editingPlan.name}
                                  onChange={(e) => setEditingPlan({
                                    ...editingPlan,
                                    name: e.target.value
                                  })}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2">Monthly Price (£)</label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editingPlan.monthly_price}
                                  onChange={(e) => setEditingPlan({
                                    ...editingPlan,
                                    monthly_price: parseFloat(e.target.value) || 0
                                  })}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-medium mb-2">Yearly Price (£)</label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editingPlan.yearly_price || ''}
                                  onChange={(e) => setEditingPlan({
                                    ...editingPlan,
                                    yearly_price: parseFloat(e.target.value) || 0
                                  })}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2">2 Year Price (£)</label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editingPlan.two_yearly_price || ''}
                                  onChange={(e) => setEditingPlan({
                                    ...editingPlan,
                                    two_yearly_price: parseFloat(e.target.value) || 0
                                  })}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2">3 Year Price (£)</label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editingPlan.three_yearly_price || ''}
                                  onChange={(e) => setEditingPlan({
                                    ...editingPlan,
                                    three_yearly_price: parseFloat(e.target.value) || 0
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
                              <Button
                                onClick={() => resetToDefaults(editingPlan.name)}
                                variant="outline"
                                size="sm"
                                className="text-blue-600 border-blue-300 hover:bg-blue-50"
                              >
                                Reset to Correct Defaults & Save
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
                                            <div>
                                              <label className="text-xs text-gray-500">Total £</label>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                value={getPricingValue(period, excess, 'total')}
                                                onChange={(e) => updatePricingMatrix(period, excess, 'total', parseFloat(e.target.value) || 0)}
                                                className="text-xs h-8"
                                              />
                                            </div>
                                            <div>
                                              <label className="text-xs text-gray-500">Save £</label>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                value={getPricingValue(period, excess, 'save')}
                                                onChange={(e) => updatePricingMatrix(period, excess, 'save', parseFloat(e.target.value) || 0)}
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
                              <label className="block text-sm font-medium mb-3">Coverage Features ({(Array.isArray(editingPlan.coverage) ? editingPlan.coverage : []).length} items)</label>
                              <div className="max-h-64 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                                <div className="space-y-2">
                                  {(Array.isArray(editingPlan.coverage) ? editingPlan.coverage : []).map((item: any, index: number) => (
                                    <div key={index} className="flex items-center space-x-2 bg-white p-2 rounded border">
                                      <Input
                                        value={item}
                                        onChange={(e) => updateCoverageItem(index, e.target.value)}
                                        className="flex-1 text-sm"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeCoverageItem(index)}
                                        className="text-red-600 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 mt-3">
                                <Input
                                  placeholder="Add new coverage feature..."
                                  value={newCoverageItem}
                                  onChange={(e) => setNewCoverageItem(e.target.value)}
                                  onKeyPress={(e) => e.key === 'Enter' && addCoverageItem()}
                                />
                                <Button 
                                  onClick={addCoverageItem} 
                                  size="sm"
                                  className="bg-orange-600 hover:bg-orange-700"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium mb-3">Add-ons ({(Array.isArray(editingPlan.add_ons) ? editingPlan.add_ons : []).length} items)</label>
                              <div className="max-h-48 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                                <div className="space-y-2">
                                  {(Array.isArray(editingPlan.add_ons) ? editingPlan.add_ons : []).map((item: any, index: number) => (
                                    <div key={index} className="flex items-center space-x-2 bg-white p-2 rounded border">
                                      <Input
                                        value={item}
                                        onChange={(e) => updateAddOnItem(index, e.target.value)}
                                        className="flex-1 text-sm"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeAddOnItem(index)}
                                        className="text-red-600 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 mt-3">
                                <Input
                                  placeholder="Add new add-on..."
                                  value={newAddOnItem}
                                  onChange={(e) => setNewAddOnItem(e.target.value)}
                                  onKeyPress={(e) => e.key === 'Enter' && addAddOnItem()}
                                />
                                <Button 
                                  onClick={addAddOnItem} 
                                  size="sm"
                                  className="bg-orange-600 hover:bg-orange-700"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded">
                              <input
                                type="checkbox"
                                id="is_active"
                                checked={editingPlan.is_active}
                                onChange={(e) => setEditingPlan({
                                  ...editingPlan,
                                  is_active: e.target.checked
                                })}
                                className="rounded"
                              />
                              <label htmlFor="is_active" className="text-sm font-medium">
                                Plan is active and visible to customers
                              </label>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t">
                              <Button variant="outline" onClick={() => setEditingPlan(null)}>
                                Cancel
                              </Button>
                              <Button 
                                onClick={() => savePlan(editingPlan)}
                                className="bg-orange-600 hover:bg-orange-700"
                              >
                                <Save className="h-4 w-4 mr-2" />
                                Save Changes
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Coverage Features ({coverageArray.length} items):</h4>
                    <div className="max-h-32 overflow-y-auto">
                      <ul className="text-sm text-gray-600 space-y-1">
                        {coverageArray.slice(0, 5).map((item: any, index: number) => (
                          <li key={index} className="flex items-start">
                            <span className="w-2 h-2 bg-orange-500 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                            <span className="line-clamp-1">{item}</span>
                          </li>
                        ))}
                        {coverageArray.length > 5 && (
                          <li className="text-xs text-gray-500 font-medium">+{coverageArray.length - 5} more features</li>
                        )}
                      </ul>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Add-ons ({addOnsArray.length} items):</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {addOnsArray.slice(0, 3).map((item: any, index: number) => (
                        <li key={index} className="flex items-center">
                          <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                          {item}
                        </li>
                      ))}
                      {addOnsArray.length > 3 && (
                        <li className="text-xs text-gray-500 font-medium">+{addOnsArray.length - 3} more add-ons</li>
                      )}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
