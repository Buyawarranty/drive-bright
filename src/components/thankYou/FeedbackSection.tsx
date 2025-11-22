import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FeedbackSectionProps {
  onSurveyClick?: () => void;
  policyNumber?: string;
}

export const FeedbackSection: React.FC<FeedbackSectionProps> = ({
  onSurveyClick,
  policyNumber
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Question 1
  const [reasonsChosen, setReasonsChosen] = useState<string[]>([]);
  const [otherReason, setOtherReason] = useState('');
  
  // Question 2
  const [easeRating, setEaseRating] = useState('');
  const [easeExplanation, setEaseExplanation] = useState('');
  
  // Question 3
  const [suggestions, setSuggestions] = useState('');

  const handleSubmit = async () => {
    if (!easeRating) {
      toast.error('Please answer question 2');
      return;
    }

    if (onSurveyClick) {
      onSurveyClick();
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('submit-survey', {
        body: {
          policyNumber: policyNumber || 'N/A',
          reasonsChosen: reasonsChosen.length > 0 ? reasonsChosen : ['None selected'],
          otherReason: otherReason || '',
          easeRating,
          easeExplanation: easeExplanation || '',
          suggestions: suggestions || '',
          submittedAt: new Date().toISOString()
        }
      });

      if (error) throw error;

      toast.success('Thank you for your feedback!');
      setIsOpen(false);
      
      // Reset form
      setReasonsChosen([]);
      setOtherReason('');
      setEaseRating('');
      setEaseExplanation('');
      setSuggestions('');
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReasonToggle = (reason: string) => {
    setReasonsChosen(prev => 
      prev.includes(reason) 
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    );
  };

  return (
    <Card className="border border-border shadow-sm bg-gradient-to-br from-green-50 to-background">
      <CardContent className="p-6 md:p-8">
        {!isOpen ? (
          <div className="text-center">
            <MessageSquare className="w-10 h-10 text-primary mx-auto mb-4" />
            <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">
              How was your experience today?
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              3 simple questions to help us improve
            </p>
            <Button
              onClick={() => setIsOpen(true)}
              variant="outline"
              className="hover:border-primary hover:bg-primary/5"
            >
              📝 Take a 1-Minute Survey
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-foreground text-center mb-4">
              Quick Feedback Survey
            </h3>

            {/* Question 1 */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                1. What made you choose Buy-A-Warranty today?
              </Label>
              <div className="space-y-2">
                {['The price was right', 'The cover looked solid', 'I trusted the reviews', 'A friend recommended it'].map((reason) => (
                  <div key={reason} className="flex items-center space-x-2">
                    <Checkbox
                      id={reason}
                      checked={reasonsChosen.includes(reason)}
                      onCheckedChange={() => handleReasonToggle(reason)}
                    />
                    <Label htmlFor={reason} className="font-normal cursor-pointer">
                      {reason}
                    </Label>
                  </div>
                ))}
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="other"
                    checked={reasonsChosen.includes('Other')}
                    onCheckedChange={() => handleReasonToggle('Other')}
                  />
                  <div className="flex-1">
                    <Label htmlFor="other" className="font-normal cursor-pointer mb-2 block">
                      Other:
                    </Label>
                    <input
                      type="text"
                      placeholder="Please specify..."
                      value={otherReason}
                      onChange={(e) => setOtherReason(e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-md text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Question 2 */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                2. How easy was it to complete your purchase?
              </Label>
              <RadioGroup value={easeRating} onValueChange={setEaseRating}>
                {['Extremely easy', 'Fairly easy', 'Neutral', 'A bit difficult', 'Difficult'].map((rating) => (
                  <div key={rating} className="flex items-center space-x-2">
                    <RadioGroupItem value={rating} id={rating} />
                    <Label htmlFor={rating} className="font-normal cursor-pointer">
                      {rating}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              
              {(easeRating === 'Neutral' || easeRating === 'A bit difficult' || easeRating === 'Difficult') && (
                <div className="mt-3">
                  <Label className="text-sm mb-2 block">Please explain why:</Label>
                  <Textarea
                    placeholder="Tell us what made it difficult..."
                    value={easeExplanation}
                    onChange={(e) => setEaseExplanation(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              )}
            </div>

            {/* Question 3 */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                3. Any comments or suggestions to help us improve?
              </Label>
              <Textarea
                placeholder="Your feedback is valuable to us..."
                value={suggestions}
                onChange={(e) => setSuggestions(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  '✅ Submit Feedback'
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
