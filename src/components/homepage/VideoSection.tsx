import React, { useRef, useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface VideoSectionProps {
  scrollToQuoteForm: () => void;
}

const VideoSection: React.FC<VideoSectionProps> = ({ scrollToQuoteForm }) => {
  const [isVideoInView, setIsVideoInView] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVideoInView(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' }
    );

    observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="pt-12 md:pt-20 pb-6 md:pb-10 bg-brand-gray-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-center">
          <div className="relative aspect-video">
            <video 
              ref={videoRef}
              src={isVideoInView ? "/warranty-explainer-new.mp4" : undefined}
              poster="/warranty-explainer-thumbnail-new.jpg"
              title="Extended warranty explainer video"
              className="w-full h-full rounded-md shadow-lg"
              controls
              preload="none"
            >
              Your browser does not support the video tag.
            </video>
          </div>

          <div className="space-y-6 md:space-y-8">
            <div>
              <h2 className="text-2xl md:text-4xl font-bold text-brand-dark-text leading-tight mb-4 md:mb-6">
                Reliable extended warranty
                <br />
                <span className="text-brand-orange">If it breaks, we'll fix it 🔧</span>
              </h2>
              <p className="text-base md:text-lg text-brand-dark-text leading-relaxed">
                Enjoy complete peace of mind with our comprehensive cover. From vital mechanical components to essential electrical parts, we've got it all covered.
              </p>
            </div>

            <button 
              onClick={scrollToQuoteForm}
              className="bg-brand-deep-blue hover:bg-blue-800 text-white font-bold px-6 md:px-10 py-3 md:py-4 text-lg md:text-xl rounded shadow-lg transition-colors w-full sm:w-auto flex items-center justify-center gap-2"
            >
              Start Cover
              <ArrowRight className="w-5 h-5" strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VideoSection;
