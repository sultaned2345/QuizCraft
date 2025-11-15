// src/app/(app)/essay-grader/page.tsx
'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import dynamic from 'next/dynamic'; // <-- 1. IMPORT DYNAMIC

// --- 2. DYNAMICALLY IMPORT THE DIFF VIEWER ---
const ReactDiffViewer = dynamic(
  () => import('react-diff-viewer'),
  { ssr: false } // <-- 3. DISABLE SSR
);
// --- END CHANGE ---

interface GradedFeedback {
  score: number;
  overall_feedback: string;
  suggestions: string[];
  original_with_feedback: string;
}

export default function EssayGraderPage() {
  const [essayText, setEssayText] = useState('');
  const [feedback, setFeedback] = useState<GradedFeedback | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const handleGradeEssay = useCallback(async () => {
    if (!essayText.trim()) {
      setError('Please paste your essay into the text box.');
      return;
    }
    if (essayText.trim().split(' ').length < 50) {
      setError('Essay must be at least 50 words to grade.');
      return;
    }

    setIsLoading(true);
    setError('');
    setFeedback(null);

    try {
      const response = await fetch('/api/grade-essay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essayText }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to get feedback from AI.');
      }

      const data = await response.json();
      setFeedback(data.feedback);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [essayText]);

  // ... (rest of the component is unchanged)
  
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            AI Essay Grader
          </CardTitle>
          <CardDescription>
            Paste your essay below to get instant feedback on clarity,
            argumentation, and grammar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Paste your full essay text here..."
            className="min-h-[250px] text-base"
            value={essayText}
            onChange={(e) => setEssayText(e.target.value)}
            disabled={isLoading}
          />
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground w-full text-center sm:text-left">
            {essayText.trim().split(' ').length} words
          </div>
          <Button
            onClick={handleGradeEssay}
            disabled={isLoading || !essayText.trim()}
            className="w-full sm:w-auto"
          }
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Grade My Essay
          </Button>
        </CardFooter>
      </Card>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {isLoading && (
        <Card className="mb-6">
          <CardContent className="p-6 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-4" />
            <p className="text-lg font-semibold">Grading in progress...</p>
            <p className="text-muted-foreground">
              Our AI is analyzing your essay. This may take up to a minute.
            </p>
          </CardContent>
        </Card>
      )}

      {feedback && (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Feedback Report</CardTitle>
            <CardDescription>
              Here is the AI's analysis of your essay.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center bg-muted/50 p-6 rounded-lg">
              <p className="text-sm font-semibold text-muted-foreground">
                OVERALL SCORE
              </p>
              <p className="text-6xl font-bold text-primary">
                {feedback.score}
                <span className="text-3xl text-muted-foreground">/100</span>
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Overall Feedback</h3>
              <p className="text-muted-foreground leading-relaxed">
                {feedback.overall_feedback}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Actionable Suggestions</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                {feedback.suggestions.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Detailed Breakdown</h3>
              <div className="rounded-lg border bg-card text-sm overflow-hidden">
                {/* --- 4. THIS WILL NOW RENDER CORRECTLY --- */}
                <ReactDiffViewer
                  oldValue={essayText}
                  newValue={feedback.original_with_feedback}
                  splitView={false}
                  hideLineNumbers={true}
                  useDarkTheme={true} // Set this based on your app's theme context if you can
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}