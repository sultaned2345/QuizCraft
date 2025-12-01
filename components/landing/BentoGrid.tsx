'use client';

import { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import { BrainCircuit, MessageSquare, Layers, FileText, PenTool, FolderKanban, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const BentoCard = ({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    className={className}
  >
    <Card className="h-full bg-card/40 backdrop-blur-md border-primary/10 hover:border-primary/30 transition-all duration-300 overflow-hidden group">
      {children}
    </Card>
  </motion.div>
);

export function BentoGrid() {
  const [quizReady, setQuizReady] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    // Simulate processing
    const interval = setInterval(() => {
        setQuizReady(prev => !prev);
    }, 4000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 relative overflow-hidden">
        {/* Background Aura for this section */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] -z-10" />

      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">Everything you need to <span className="text-primary">excel</span></h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            A complete suite of tools designed to transform how you retain information.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-3 gap-4 h-auto md:h-[800px]">
            
          {/* Main Feature: Quiz Gen (Large) */}
          <BentoCard className="md:col-span-2 md:row-span-2" delay={0.1}>
            <CardContent className="p-8 h-full flex flex-col justify-between relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <BrainCircuit className="w-48 h-48" />
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary mb-4">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold mb-2">AI Quiz Generation</h3>
                <p className="text-muted-foreground">Upload any PDF, Doc, or Paste text. Our AI instantly analyzes the content and generates exam-ready questions.</p>
              </div>
              
              {/* Mock UI Element - Processing to Complete Animation */}
              <div className="mt-8 bg-background/50 rounded-lg p-4 border border-border/50 backdrop-blur-sm transition-all duration-500">
                {!quizReady ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                            <span className="text-xs font-mono text-muted-foreground">Analyzing content...</span>
                        </div>
                        <div className="space-y-2">
                            <div className="h-2 bg-primary/20 rounded w-3/4 animate-pulse" />
                            <div className="h-2 bg-primary/10 rounded w-1/2 animate-pulse" />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="text-xs font-mono text-green-600 font-bold">Quiz Generated!</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <span className="px-2 py-1 rounded bg-primary/10 text-[10px] font-bold text-primary">Multiple Choice</span>
                                <span className="px-2 py-1 rounded bg-primary/10 text-[10px] font-bold text-primary">True/False</span>
                            </div>
                        </div>
                    </div>
                )}
              </div>
            </CardContent>
          </BentoCard>

          {/* Secondary: Chat (Tall) */}
          <BentoCard className="md:col-span-1 md:row-span-2" delay={0.2}>
            <CardContent className="p-6 h-full flex flex-col">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold mb-2">Doc Chat</h3>
              <p className="text-sm text-muted-foreground mb-4">Ask your textbooks questions directly.</p>
              
              <div className="mt-auto space-y-3">
                <div className="bg-primary/10 p-3 rounded-lg rounded-tl-none text-xs leading-relaxed">
                    What is the mitochondria?
                </div>
                {/* Animated Answer Bubble */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1, duration: 0.4 }}
                    className="bg-muted p-3 rounded-lg rounded-tr-none text-xs ml-4 border border-border leading-relaxed"
                >
                    The powerhouse of the cell.
                </motion.div>
              </div>
            </CardContent>
          </BentoCard>

          {/* Stat: Project Org (Small) - REPLACED Grades */}
          <BentoCard className="md:col-span-1 md:row-span-1" delay={0.3}>
             <CardContent className="p-6 flex flex-col justify-center h-full">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500 mb-3">
                    <FolderKanban className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg mb-1">Projects</h3>
                <p className="text-xs text-muted-foreground">Organize your quizzes and notes by subject.</p>
             </CardContent>
          </BentoCard>

          {/* Stat: Summaries (Small) - REPLACED Streak */}
          <BentoCard className="md:col-span-1 md:row-span-1" delay={0.4}>
            <CardContent className="p-6 flex flex-col justify-center h-full">
                 <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 mb-3">
                    <FileText className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg mb-1">Summaries</h3>
                <p className="text-xs text-muted-foreground">Digest complex topics in seconds.</p>
            </CardContent>
          </BentoCard>

          {/* Feature: Flashcards (Wide) */}
          <BentoCard className="md:col-span-2 md:row-span-1" delay={0.5}>
            <CardContent className="p-6 flex items-center gap-6 h-full">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                    <Layers className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-xl font-bold">Smart Flashcards</h3>
                    <p className="text-sm text-muted-foreground">Spaced repetition algorithms built-in to ensure you never forget a term.</p>
                </div>
            </CardContent>
          </BentoCard>

           {/* Feature: Essay Grader (Wide) - REPLACED Auto-Scheduling */}
           <BentoCard className="md:col-span-2 md:row-span-1" delay={0.6}>
            <CardContent className="p-6 flex items-center gap-6 h-full">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500">
                    <PenTool className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-xl font-bold">AI Essay Grader</h3>
                    <p className="text-sm text-muted-foreground">Get instant feedback, scoring, and suggestions to improve your writing.</p>
                </div>
            </CardContent>
          </BentoCard>

        </div>
      </div>
    </section>
  );
}