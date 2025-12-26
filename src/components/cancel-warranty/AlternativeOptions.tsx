import React from 'react';
import { Pause, TrendingDown, ArrowRightLeft } from 'lucide-react';

const AlternativeOptions: React.FC = () => {
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

  return (
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
          <p className="text-muted-foreground">
            Interested in any of these options?{' '}
            <a 
              href="mailto:support@buyawarranty.co.uk" 
              className="text-primary font-semibold hover:underline"
            >
              Contact our team
            </a>
            {' '}and we'll arrange it for you.
          </p>
        </div>
      </div>
    </section>
  );
};

export default AlternativeOptions;