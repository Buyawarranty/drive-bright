import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Brain, Sparkles, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AIEmailSuggestionsProps {
  currentSubject?: string;
  currentContent?: string;
  onApplySuggestion?: (subject: string, content: string) => void;
}

export const AIEmailSuggestions: React.FC<AIEmailSuggestionsProps> = ({
  currentSubject = '',
  currentContent = '',
  onApplySuggestion
}) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<{
    subject: string[];
    content: string;
    sendTime: string;
  } | null>(null);

  const generateSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-email-suggestions', {
        body: {
          subject: currentSubject,
          content: currentContent
        }
      });

      if (error) throw error;

      setSuggestions(data.suggestions);
      toast.success('AI suggestions generated successfully');
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast.error('Failed to generate AI suggestions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          🧠 Smart Suggestions
        </CardTitle>
        <CardDescription>
          Get AI-powered tips for subject lines, send times, and content improvements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!suggestions ? (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-purple-500 opacity-50" />
            <p className="text-muted-foreground mb-4">
              Get AI-powered suggestions to improve your email campaign
            </p>
            <Button onClick={generateSuggestions} disabled={loading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Generate Suggestions
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Subject Line Ideas
              </h4>
              <div className="space-y-2">
                {suggestions.subject.map((subject, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 border rounded-lg hover:bg-accent">
                    <p className="text-sm flex-1">{subject}</p>
                    {onApplySuggestion && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onApplySuggestion(subject, currentContent)}
                      >
                        Use
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Content Improvements</h4>
              <div className="p-3 border rounded-lg bg-accent/50">
                <p className="text-sm whitespace-pre-wrap">{suggestions.content}</p>
                {onApplySuggestion && (
                  <Button 
                    size="sm" 
                    className="mt-3"
                    onClick={() => onApplySuggestion(currentSubject, suggestions.content)}
                  >
                    Apply Content
                  </Button>
                )}
              </div>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Best Send Time:</strong> {suggestions.sendTime}
              </AlertDescription>
            </Alert>

            <Button 
              variant="outline" 
              onClick={generateSuggestions}
              disabled={loading}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate New Suggestions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

function RefreshCw(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}
