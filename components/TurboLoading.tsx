// src/components/TurboLoading.tsx
'use client';

import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Cpu, ShieldCheck, Database, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const LOADING_STEPS = [
  "INITIALIZING_NEURAL_CORE...",
  "PARSING_SOURCE_DOCUMENT...",
  "EXTRACTING_SEMANTIC_LAYERS...",
  "GENERATING_KNOWLEDGE_GRAPH...",
  "SYNTHESIZING_QUIZ_VECTORS...",
  "OPTIMIZING_FLASHCARD_DECK...",
  "FINALIZING_OUTPUT_STREAMS..."
];

interface TurboLoadingProps {
  status?: string;
  statuses?: Record<string, any>; // FIX: Added statuses prop to match usage
  className?: string;
}

export function TurboLoading({ 
  status = "PROCESSING",
  statuses,
  className 
}: TurboLoadingProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Cycle through "fake" logs to keep user engaged
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[50vh] w-full bg-background p-8", className)}>
      
      {/* 1. The "Neural Core" Animation */}
      <div className="relative mb-12">
        {/* Outer Ring */}
        <div className="absolute inset-0 w-32 h-32 border-t-2 border-primary/50 rounded-full animate-spin duration-[3000ms]" />
        {/* Inner Ring (Counter-rotating) */}
        <div className="absolute inset-2 w-28 h-28 border-b-2 border-emerald-500/50 rounded-full animate-spin duration-[2000ms] direction-reverse" />
        
        {/* Center Glow */}
        <div className="relative flex items-center justify-center w-32 h-32">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center backdrop-blur-sm animate-pulse">
            <Cpu className="w-10 h-10 text-primary animate-pulse" />
          </div>
        </div>

        {/* Floating Particles */}
        <Sparkles className="absolute -top-4 -right-4 w-6 h-6 text-yellow-400 animate-bounce delay-100 opacity-50" />
        <Database className="absolute -bottom-4 -left-4 w-6 h-6 text-blue-400 animate-bounce delay-300 opacity-50" />
      </div>

      {/* 2. Text Status */}
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-2xl font-bold font-mono tracking-wider text-foreground">
          AI GENERATION IN PROGRESS
        </h2>
        
        {/* 3. The "Terminal" Log */}
        <div className="h-12 flex items-center justify-center overflow-hidden relative">
          <div className="font-mono text-sm text-emerald-400 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            {LOADING_STEPS[currentStep]}
          </div>
        </div>
        
        {/* Optional: Show granular statuses if useful */}
        {statuses && (
           <div className="flex gap-2 justify-center text-xs text-muted-foreground mt-2">
              <span className={cn(statuses.quiz ? "text-green-500" : "opacity-50")}>Quiz</span>
              <span className="opacity-30">•</span>
              <span className={cn(statuses.note ? "text-green-500" : "opacity-50")}>Notes</span>
              <span className="opacity-30">•</span>
              <span className={cn(statuses.flashcards ? "text-green-500" : "opacity-50")}>Decks</span>
           </div>
        )}

        <p className="text-muted-foreground text-sm">
          This may take up to 60 seconds depending on file size.
          <br/>
          Please do not close this tab.
        </p>
      </div>

      {/* 4. Progress Bar */}
      <div className="w-64 h-1.5 bg-muted rounded-full mt-8 overflow-hidden relative">
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-emerald-500 to-primary w-full animate-shimmer" 
             style={{ 
               animation: 'shimmer 2s infinite linear',
               backgroundSize: '200% 100%' 
             }}
        />
      </div>
      
    </div>
  );
}

// Add this animation to your globals.css if 'animate-shimmer' isn't defined:
// @keyframes shimmer {
//   0% { transform: translateX(-100%); }
//   100% { transform: translateX(100%); }
// }