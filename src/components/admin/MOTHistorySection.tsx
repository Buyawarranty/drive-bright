import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertCircle, CheckCircle, Clock, Car, Fuel, Calendar, FileX, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface MOTTest {
  completedDate: string;
  testResult: string;
  expiryDate?: string;
  odometerValue?: number;
  odometerUnit?: string;
  motTestNumber?: string;
  defects?: Array<{
    text: string;
    type: string;
    dangerous?: boolean;
  }>;
}

interface MOTHistoryData {
  id: string;
  registration: string;
  make?: string;
  model?: string;
  primary_colour?: string;
  fuel_type?: string;
  mot_tests: any; // This will be JSON from the database
  dvla_id?: string;
  registration_date?: string;
  manufacture_date?: string;
  engine_capacity?: number;
  co2_emissions?: number;
  euro_status?: string;
  real_driving_emissions?: string;
  marked_for_export?: boolean;
  colour?: string;
  type_approval?: string;
  wheelplan?: string;
  revenue_weight?: number;
  date_of_last_v5c_issued?: string;
  mot_expiry_date?: string;
  created_at: string;
  updated_at: string;
}

interface MOTHistory extends Omit<MOTHistoryData, 'mot_tests'> {
  mot_tests: MOTTest[];
}

interface MOTHistorySectionProps {
  registrationNumber?: string;
  customerId?: string;
}

export const MOTHistorySection: React.FC<MOTHistorySectionProps> = ({ 
  registrationNumber, 
  customerId 
}) => {
  const [motHistory, setMOTHistory] = useState<MOTHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (registrationNumber) {
      fetchMOTHistory();
    }
  }, [registrationNumber]);

  const fetchMOTHistory = async () => {
    if (!registrationNumber) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mot_history')
        .select('*')
        .eq('registration', registrationNumber.toUpperCase())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching MOT history:', error);
        return;
      }

      if (data) {
        // Convert the JSON mot_tests to proper array
        const processedData: MOTHistory = {
          ...data,
          mot_tests: Array.isArray(data.mot_tests) ? (data.mot_tests as unknown as MOTTest[]) : []
        };
        setMOTHistory(processedData);
      }
    } catch (error) {
      console.error('Error fetching MOT history:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFreshMOTHistory = async () => {
    if (!registrationNumber) return;
    
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-mot-history', {
        body: { 
          registration: registrationNumber,
          customer_id: customerId || null
        }
      });

      if (error) throw error;

      if (data?.success) {
        // Convert the JSON mot_tests to proper array
        const processedData: MOTHistory = {
          ...data.data,
          mot_tests: Array.isArray(data.data.mot_tests) ? (data.data.mot_tests as unknown as MOTTest[]) : []
        };
        setMOTHistory(processedData);
        toast.success('MOT history updated successfully');
      } else {
        toast.error(data?.error || 'Failed to fetch MOT history');
      }
    } catch (error) {
      console.error('Error fetching fresh MOT history:', error);
      toast.error('Failed to fetch MOT history');
    } finally {
      setRefreshing(false);
    }
  };

  const getTestResultBadge = (result: string) => {
    switch (result.toLowerCase()) {
      case 'pass':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Pass</Badge>;
      case 'fail':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Fail</Badge>;
      case 'advisory':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Advisory</Badge>;
      default:
        return <Badge variant="outline">{result}</Badge>;
    }
  };

  const getDefectSeverity = (defect: any) => {
    if (defect.dangerous) {
      return <Badge variant="destructive" className="text-xs">Dangerous</Badge>;
    }
    switch (defect.type?.toLowerCase()) {
      case 'major':
        return <Badge variant="destructive" className="text-xs">Major</Badge>;
      case 'minor':
        return <Badge variant="secondary" className="text-xs">Minor</Badge>;
      case 'advisory':
        return <Badge variant="outline" className="text-xs">Advisory</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{defect.type}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            MOT History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Loading MOT history...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!motHistory) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            MOT History
          </CardTitle>
          <CardDescription>
            No MOT history found for {registrationNumber}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={fetchFreshMOTHistory} 
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            {refreshing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Fetch MOT History
          </Button>
        </CardContent>
      </Card>
    );
  }

  const sortedTests = [...motHistory.mot_tests].sort((a, b) => 
    new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              MOT History
            </CardTitle>
            <CardDescription>
              Last updated: {format(new Date(motHistory.updated_at), 'dd/MM/yyyy HH:mm')}
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchFreshMOTHistory} 
            disabled={refreshing}
          >
            {refreshing ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Vehicle Information */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="text-sm font-medium text-gray-500">Make/Model</div>
            <div className="text-sm">{motHistory.make} {motHistory.model}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500">Colour</div>
            <div className="text-sm">{motHistory.primary_colour || motHistory.colour}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500">Fuel Type</div>
            <div className="text-sm flex items-center gap-1">
              <Fuel className="w-3 h-3" />
              {motHistory.fuel_type}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500">Engine Size</div>
            <div className="text-sm">{motHistory.engine_capacity ? `${motHistory.engine_capacity}cc` : 'N/A'}</div>
          </div>
        </div>

        {/* MOT Expiry */}
        {motHistory.mot_expiry_date && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-900">MOT Expires:</span>
              <span className="text-blue-700">
                {format(new Date(motHistory.mot_expiry_date), 'dd MMMM yyyy')}
              </span>
            </div>
          </div>
        )}

        {/* MOT Tests */}
        <div>
          <h4 className="font-semibold mb-3">MOT Test History ({sortedTests.length} tests)</h4>
          {sortedTests.length === 0 ? (
            <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg">
              <FileX className="w-5 h-5 text-gray-400" />
              <span className="text-gray-600">No MOT tests found</span>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {sortedTests.map((test, index) => (
                <AccordionItem 
                  key={index} 
                  value={`test-${index}`}
                  className="border border-gray-200 rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        {getTestResultBadge(test.testResult)}
                        <span className="font-medium">
                          {format(new Date(test.completedDate), 'dd/MM/yyyy')}
                        </span>
                        {test.odometerValue && (
                          <span className="text-sm text-gray-600">
                            {test.odometerValue.toLocaleString()} {test.odometerUnit}
                          </span>
                        )}
                      </div>
                      {test.expiryDate && (
                        <span className="text-sm text-gray-500">
                          Expires: {format(new Date(test.expiryDate), 'dd/MM/yyyy')}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <div className="space-y-3">
                      {test.motTestNumber && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Test Number: </span>
                          <span className="text-sm font-mono">{test.motTestNumber}</span>
                        </div>
                      )}
                      
                      {test.defects && test.defects.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium mb-2">
                            Defects ({test.defects.length})
                          </h5>
                          <div className="space-y-2">
                            {test.defects.map((defect, defectIndex) => (
                              <div 
                                key={defectIndex}
                                className="flex items-start gap-2 p-2 bg-gray-50 rounded"
                              >
                                {getDefectSeverity(defect)}
                                <span className="text-sm flex-1">{defect.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </CardContent>
    </Card>
  );
};