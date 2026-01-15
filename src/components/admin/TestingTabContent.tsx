import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ManualPaymentProcessor } from '@/components/admin/ManualPaymentProcessor';
import OrderReconciliation from '@/components/admin/OrderReconciliation';
import { ApiConnectivityTest } from '@/components/admin/ApiConnectivityTest';
import { EmailFunctionDiagnostics } from '@/components/admin/EmailFunctionDiagnostics';
import { TestPolicyDocumentsEmail } from '@/components/admin/TestPolicyDocumentsEmail';
import { TestAbandonedCartEmail } from '@/components/admin/TestAbandonedCartEmail';
import { TestTrustpilotEmail } from '@/components/admin/TestTrustpilotEmail';
import { SimpleEmailTest } from '@/components/admin/SimpleEmailTest';
import { TestEmailFunctionDirect } from '@/components/admin/TestEmailFunctionDirect';
import { TestAutomatedEmail } from '@/components/admin/TestAutomatedEmail';
import { ResendWelcomeEmail } from '@/components/admin/ResendWelcomeEmail';
import CreateTestCustomer from '@/components/CreateTestCustomer';
import CreateTestAdmin from '@/components/admin/CreateTestAdmin';
import ResetAdminPassword from '@/components/admin/ResetAdminPassword';
import { ResetCustomerPassword } from '@/components/admin/ResetCustomerPassword';
import SetAdminPassword from '@/components/admin/SetAdminPassword';
import TestWarranties2000 from '@/components/TestWarranties2000';
import TestWarranties2000AddOns from '@/components/TestWarranties2000AddOns';
import TestBumper from '@/components/TestBumper';

// Error Boundary for Testing Tab
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class TestingTabErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Testing Tab Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-4xl mx-auto p-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Error Loading Testing Tab</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                There was an error loading the testing tools. Check the console for details.
              </p>
              <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-auto">
                {this.state.error?.message || 'Unknown error'}
              </pre>
              <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                {this.state.error?.stack}
              </pre>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export const TestingTabContent = () => {
  console.log('TestingTabContent rendering...');
  
  return (
    <TestingTabErrorBoundary>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Testing Tools</h1>
          <p className="text-gray-600 mt-2">Tools for testing and development</p>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          <ManualPaymentProcessor />
          
          <OrderReconciliation />
          
          <ApiConnectivityTest />
          
          <EmailFunctionDiagnostics />
          
          <TestPolicyDocumentsEmail />
          
          <TestAbandonedCartEmail />
          
          <TestTrustpilotEmail />
          
          <SimpleEmailTest />
          
          <TestEmailFunctionDirect />
          
          <TestAutomatedEmail />
          
          <ResendWelcomeEmail />
          
          <CreateTestCustomer />
          
          <CreateTestAdmin />
          
          <ResetAdminPassword />
          
          <ResetCustomerPassword />
          
          <SetAdminPassword />
          
          <Card>
            <CardHeader>
              <CardTitle>Test Credentials</CardTitle>
              <CardDescription>
                Use these credentials to test the customer login
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <span className="font-medium">Email:</span> test@customer.com
                </div>
                <div>
                  <span className="font-medium">Password:</span> password123
                </div>
              </div>
            </CardContent>
          </Card>
          
          <TestWarranties2000 />
          
          <TestWarranties2000AddOns />
          
          <TestBumper />
        </div>
      </div>
    </TestingTabErrorBoundary>
  );
};

export default TestingTabContent;
