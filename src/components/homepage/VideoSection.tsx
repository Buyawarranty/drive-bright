import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface VideoSectionProps {
  scrollToQuoteForm: () => void;
}

const VideoSection: React.FC<VideoSectionProps> = ({ scrollToQuoteForm }) => {
  const [isVideoInView, setIsVideoInView] = useState(false);
  const [hasTrackedPlay, setHasTrackedPlay] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playStartTime = useRef<number | null>(null);

  // Generate or retrieve session ID for tracking
  const getSessionId = useCallback(() => {
    let sessionId = sessionStorage.getItem('video_session_id');
    if (!sessionId) {
      sessionId = `vs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('video_session_id', sessionId);
    }
    return sessionId;
  }, []);

  // Track video play event
  const trackVideoPlay = useCallback(async () => {
    if (hasTrackedPlay) return;
    
    try {
      const { error } = await supabase
        .from('video_play_tracking')
        .insert({
          video_id: 'warranty-explainer',
          video_title: 'Reliable extended warranty - If it breaks, we\'ll fix it',
          page_url: window.location.href,
          user_agent: navigator.userAgent,
          session_id: getSessionId(),
        });

      if (error) {
        console.error('Error tracking video play:', error);
      } else {
        setHasTrackedPlay(true);
        playStartTime.current = Date.now();
        console.log('Video play tracked successfully');
      }
    } catch (err) {
      console.error('Failed to track video play:', err);
    }
  }, [hasTrackedPlay, getSessionId]);

  // Track video completion/pause with duration
  const trackVideoEnd = useCallback(async (completed: boolean) => {
    if (!playStartTime.current) return;
    
    const durationSeconds = Math.round((Date.now() - playStartTime.current) / 1000);
    
    try {
      // Update the most recent play record with duration
      await supabase
        .from('video_play_tracking')
        .update({ 
          play_duration_seconds: durationSeconds,
          completed 
        })
        .eq('session_id', getSessionId())
        .eq('video_id', 'warranty-explainer')
        .order('played_at', { ascending: false })
        .limit(1);
    } catch (err) {
      console.error('Failed to update video duration:', err);
    }
  }, [getSessionId]);

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

  // Add video event listeners for tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      trackVideoPlay();
    };

    const handleEnded = () => {
      trackVideoEnd(true);
    };

    const handlePause = () => {
      // Only track if video was actually playing (not just initial state)
      if (playStartTime.current) {
        trackVideoEnd(false);
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('pause', handlePause);
    };
  }, [trackVideoPlay, trackVideoEnd]);

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
              className="bg-brand-deep-blue hover:bg-blue-800 text-white font-bold px-6 md:px-10 py-3 md:py-4 text-lg md:text-xl rounded shadow-lg transition-colors w-full sm:w-auto flex items-center justify-center gap-2 animate-cta-enhanced"
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
