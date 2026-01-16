// Re-export the streamlined checkout as CustomerDetailsStep
// This maintains backward compatibility while using the new optimized component
import StreamlinedCheckout, { StreamlinedCheckoutProps } from './checkout/StreamlinedCheckout';

export type CustomerDetailsStepProps = StreamlinedCheckoutProps;

const CustomerDetailsStep = StreamlinedCheckout;

export default CustomerDetailsStep;
