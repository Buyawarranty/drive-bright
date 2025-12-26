import React from 'react';
import { Pause, TrendingDown, ArrowRightLeft } from 'lucide-react';

const AlternativeOptions: React.FC = () => {
  const options = [
    {
      icon: Pause,
      title: 'Pause your cover',
      description: 'Take a break for up to 3 months without losing your warranty.',
      benefit: "Perfect if you're not driving temporarily",
      color: 'blue'
    },
    {
      icon: TrendingDown,
      title: 'Downgrade your plan',
      description: 'Switch to a lower tier to reduce your monthly cost.',
      benefit: 'Keep protection at a lower price',
      color: 'purple'
    },
    {
      icon: ArrowRightLeft,
      title: 'Transfer your warranty',
      description: 'Selling your car? Transfer the warranty to the new owner.',
      benefit: 'Often boosts resale confidence',
      color: 'teal'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; icon: string; border: string }> = {
      blue: { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-200' },
      purple: { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-200' },
      teal: { bg: 'bg-teal-50', icon: 'text-teal-600', border: 'border-teal-200' }
    };
    return colors[color] || colors.blue;
  };

  return (
    <section className="py-12 px-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Your Options Before Cancelling
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Before you go, consider these alternatives that might work better for your situation
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {options.map((option, index) => {
            const colorClasses = getColorClasses(option.color);
            const Icon = option.icon;
            
            return (
              <div 
                key={index}
                className={`${colorClasses.bg} border-2 ${colorClasses.border} rounded-xl p-6 transition-all hover:shadow-lg`}
              >
                <div className={`w-12 h-12 rounded-full ${colorClasses.bg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-6 h-6 ${colorClasses.icon}`} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  ✔ {option.title}
                </h3>
                <p className="text-gray-700 mb-3">
                  {option.description}
                </p>
                <p className="text-sm font-medium text-gray-500 italic">
                  {option.benefit}
                </p>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-8">
          <p className="text-gray-600">
            Interested in any of these options?{' '}
            <a 
              href="mailto:support@buyawarranty.co.uk" 
              className="text-orange-600 font-semibold hover:underline"
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
