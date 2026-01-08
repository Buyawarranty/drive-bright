import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Gift, Check } from 'lucide-react';
import pandaVehicles from '@/assets/panda-vehicles.png';

interface StayOfferCardProps {
  onStaySuccess: () => void;
}

const StayOfferCard: React.FC<StayOfferCardProps> = ({ onStaySuccess }) => {
  const { toast } = useToast();
  const [stayEmail, setStayEmail] = useState('');
  const [stayRegPlate, setStayRegPlate] = useState('');
  const [isStaying, setIsStaying] = useState(false);

  const handleStayWithUs = async () => {
    if (!stayEmail.trim() || !stayRegPlate.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter your email and registration plate.",
        variant: "destructive",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stayEmail)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    
    setIsStaying(true);
    
    try {
      const response = await supabase.functions.invoke('submit-cancellation', {
        body: {
          registrationPlate: stayRegPlate,
          fullName: stayEmail,
          reason: 'CUSTOMER_STAYING',
          feedback: `Customer has decided to STAY and keep their warranty. Email: ${stayEmail}, Registration: ${stayRegPlate}. Please contact them to discuss retention options.`
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to process request');
      }

      onStaySuccess();
      
    } catch (error: any) {
      console.error('Stay request error:', error);
      toast({
        title: "Request Failed",
        description: "Please contact us directly at support@buyawarranty.co.uk",
        variant: "destructive",
      });
    } finally {
      setIsStaying(false);
    }
  };

  return (
    <div className="bg-success/10 border-2 border-success rounded-2xl p-6 shadow-lg">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto mb-4">
          <Gift className="w-8 h-8 text-success-foreground" />
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-2">
          Wait! Before You Go...
        </h3>
        <p className="text-lg text-muted-foreground">
          We'd love to keep you as a customer. Let us see what we can do for you.
        </p>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-3 bg-card rounded-lg p-3">
          <Check className="w-5 h-5 text-success" />
          <span className="text-foreground">Speak to our team about your options</span>
        </div>
        <div className="flex items-center gap-3 bg-card rounded-lg p-3">
          <Check className="w-5 h-5 text-success" />
          <span className="text-foreground">We may be able to offer you a better deal</span>
        </div>
        <div className="flex items-center gap-3 bg-card rounded-lg p-3">
          <Check className="w-5 h-5 text-success" />
          <span className="text-foreground">Keep your vehicle protected</span>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <Input
          type="text"
          placeholder="🚗 Your Registration Plate"
          value={stayRegPlate}
          onChange={(e) => setStayRegPlate(e.target.value)}
          className="h-12 border-success/50 focus:border-success focus:ring-success bg-card"
        />
        <Input
          type="email"
          placeholder="📧 Your Email Address"
          value={stayEmail}
          onChange={(e) => setStayEmail(e.target.value)}
          className="h-12 border-success/50 focus:border-success focus:ring-success bg-card"
        />
      </div>
      
      <Button 
        onClick={handleStayWithUs}
        disabled={isStaying}
        className="w-full h-14 bg-success hover:bg-success/90 text-success-foreground font-bold text-lg px-6"
      >
        {isStaying ? 'Processing...' : "Yes, I'd Like to Stay"}
      </Button>

      <p className="text-center text-sm text-success mt-4">
        Our team will be in touch to discuss your options.
      </p>

      {/* Panda Image */}
      <div className="mt-6 flex items-center justify-center">
        <img 
          src={pandaVehicles} 
          alt="Panda mascot with vehicles" 
          className="w-full max-w-[180px]"
        />
      </div>
    </div>
  );
};

export default StayOfferCard;