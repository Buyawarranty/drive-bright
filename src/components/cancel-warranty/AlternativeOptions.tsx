import React, { useState } from 'react';
import { Pause, TrendingDown, ArrowRightLeft, MessageCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const AlternativeOptions: React.FC = () => {
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const options = [
    {
      icon: Pause,
      title: 'Pause your cover',
      description: 'Take a break for up to 3 months without losing your warranty.',
      benefit: "Perfect if you're not driving temporarily",
    },
    {
      icon: TrendingDown,
      title: 'Downgrade your plan',
      description: 'Switch to a lower tier to reduce your monthly cost.',
      benefit: 'Keep protection at a lower price',
    },
    {
      icon: ArrowRightLeft,
      title: 'Transfer your warranty',
      description: 'Selling your car? Transfer the warranty to the new owner.',
      benefit: 'Often boosts resale confidence',
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Message sent!",
      description: "Our team will get back to you shortly.",
    });
    
    setFormData({ name: '', email: '', message: '' });
    setShowContactDialog(false);
    setIsSubmitting(false);
  };

  const handleWhatsApp = () => {
    window.open('https://api.whatsapp.com/message/SPQPJ6O3UBF5B1?autoload=1&app_absent=0', '_blank');
  };

  return (
    <>
      <section className="py-12 px-4 bg-secondary">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Your Options Before Cancelling
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Before you go, consider these alternatives that might work better for your situation
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {options.map((option, index) => {
              const Icon = option.icon;
              
              return (
                <div 
                  key={index}
                  className="bg-card border-2 border-border rounded-xl p-6 transition-all hover:shadow-lg hover:border-primary"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    <span className="text-success">✔</span> {option.title}
                  </h3>
                  <p className="text-muted-foreground mb-3">
                    {option.description}
                  </p>
                  <p className="text-sm font-medium text-success italic">
                    {option.benefit}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-8">
            <p className="text-muted-foreground mb-4">
              Interested in any of these options?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={() => setShowContactDialog(true)}
                variant="outline"
                className="gap-2"
              >
                <Mail className="w-4 h-4" />
                Contact Us
              </Button>
              <Button 
                onClick={handleWhatsApp}
                className="gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp Us
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Contact Our Team</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                placeholder="Your name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
                placeholder="your@email.com"
              />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                required
                placeholder="Which option interests you? Tell us about your situation..."
                rows={4}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AlternativeOptions;