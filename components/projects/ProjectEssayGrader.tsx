'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle, PenTool } from 'lucide-react';

export function ProjectEssayGrader({ projectId }: { projectId: string }) {
  const [essay, setEssay] = useState('');
  const [isGrading, setIsGrading] = useState(false);
  const [feedback, setFeedback] = useState<any>(null); // Replace with strict type later

  const handleGrade = async () => {
    if (!essay.trim() || essay.length < 50) return;
    setIsGrading(true);

    try {
      const res = await fetch('/api/grade-essay/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          essayContent: essay
        }),
      });

      const data = await res.json();
      setFeedback(data);

    } catch (error) {
      console.error("Grading failed", error);
    } finally {
      setIsGrading(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6 p-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <PenTool className="w-6 h-6" /> Essay Practice
        </h2>
        {feedback && (
            <Badge variant={feedback.score > 80 ? "default" : "destructive"} className="text-lg px-4 py-1">
              Score: {feedback.score}/100
            </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
        {/* Input Column */}
        <div className="flex flex-col gap-4">
          <Textarea 
            placeholder="Write your essay here based on the project materials..." 
            className="flex-1 resize-none p-4 font-serif text-lg leading-relaxed min-h-[400px]"
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
          />
          <Button onClick={handleGrade} disabled={isGrading || essay.length < 20} size="lg">
            {isGrading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Grade My Essay"}
          </Button>
        </div>

        {/* Feedback Column */}
        <div className="h-full">
           {!feedback ? (
             <div className="h-full border-2 border-dashed rounded-xl flex items-center justify-center text-muted-foreground p-8 text-center bg-muted/10">
               <p>Write an essay and click "Grade" to get AI feedback based on your study materials.</p>
             </div>
           ) : (
             <Card className="h-full overflow-y-auto">
               <CardHeader>
                 <CardTitle>AI Feedback</CardTitle>
               </CardHeader>
               <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-1 text-green-600 flex items-center gap-2">
                      <CheckCircle2 size={16} /> Strengths
                    </h4>
                    <p className="text-sm text-muted-foreground">{feedback.strengths}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1 text-amber-600 flex items-center gap-2">
                      <AlertCircle size={16} /> Improvements
                    </h4>
                    <p className="text-sm text-muted-foreground">{feedback.weaknesses}</p>
                  </div>
                  <div className="bg-muted p-3 rounded-lg text-xs font-mono">
                     {feedback.suggestion}
                  </div>
               </CardContent>
             </Card>
           )}
        </div>
      </div>
    </div>
  );
}