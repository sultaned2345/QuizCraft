'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrainCircuit, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface NoteQuizGeneratorProps {
  noteId: string;
  noteTitle: string;
  noteContent: string;
}

export function NoteQuizGenerator({ noteId, noteTitle, noteContent }: NoteQuizGeneratorProps) {
  const router = useRouter();
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateQuiz = async () => {
    if (!noteContent || noteContent.length < 50) {
      toast({ variant: "destructive", description: "Note is too short to generate a quiz." });
      return;
    }

    setIsLoading(true);
    try {
      // 1. Create the request payload
      // We assume your /api/generate-quiz endpoint can handle raw text context
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          topic: noteTitle,
          source_text: noteContent, // Send the note content as source
          difficulty: 'medium',
          question_count: 5,
          type: 'multiple_choice'
        }),
      });

      if (!response.ok) throw new Error('Generation failed');

      const data = await response.json();
      
      // 2. Redirect to the new quiz
      if (data.success && data.data?.id) {
        toast({ title: "Quiz Ready!", description: "Redirecting you to the quiz..." });
        router.push(`/quiz/${data.data.id}`);
      } else {
        throw new Error('Invalid response');
      }

    } catch (error) {
      console.error("Quiz gen error:", error);
      toast({ variant: "destructive", description: "Failed to generate quiz from note." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="hidden xl:flex w-72 border-l border-border/50 flex-col bg-muted/10 h-full">
      <div className="p-4 border-b border-border/50">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <BrainCircuit className="w-4 h-4 text-primary" />
          Neural Engine
        </h3>
      </div>
      
      <div className="p-6 flex-1 flex flex-col items-center justify-center text-center space-y-6">
        <div className="relative">
           <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
           <div className="relative bg-card border border-border p-4 rounded-2xl shadow-sm">
              <BrainCircuit className="w-8 h-8 text-primary" />
           </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Test Your Knowledge</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Turn this note into an interactive quiz to verify your retention using active recall.
          </p>
        </div>

        <Button 
          onClick={handleGenerateQuiz} 
          disabled={isLoading} 
          className="w-full shadow-lg shadow-primary/20 transition-all hover:scale-105"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2 fill-current" /> Generate Quiz
            </>
          )}
        </Button>
      </div>
    </div>
  );
}