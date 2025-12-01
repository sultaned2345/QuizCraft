'use client';

import { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import { BrainCircuit, MessageSquare, Layers, FileText, PenTool, FolderKanban, CheckCircle2, Download, Globe, Smartphone, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const BentoCard = ({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    className={className}
  >
    <Card className="h-full bg-card/40 backdrop-blur-md border-primary/10 hover:border-primary/30 transition-all duration-300 overflow-hidden group relative">
      {children}
    </Card>
  </motion.div>
);

export function BentoGrid() {
  const [quizReady, setQuizReady] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
        setQuizReady(prev => !prev);
    }, 4000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] -z-10" />

      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">Everything you need to <span className="text-primary">excel</span></h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            A complete suite of tools designed to transform how you retain information.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-3 gap-4 h-auto md:h-[900px]">
            
          {/* 1. MAIN: Quiz Generation */}
          <BentoCard className="md:col-span-2 md:row-span-2" delay={0.1}>
            <CardContent className="p-8 h-full flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -right-10 -top-10 opacity-5">
                <BrainCircuit className="w-64 h-64" />
              </div>
              
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary mb-4">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold mb-2">AI Quiz Generation</h3>
                <p className="text-muted-foreground">Upload any PDF, Doc, or Paste text. Our AI instantly analyzes the content and generates exam-ready questions.</p>
              </div>
              
              <div className="mt-8 bg-background/50 rounded-xl p-4 border border-border/50 backdrop-blur-sm transition-all duration-500 shadow-sm">
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
                        <div className="flex gap-2">
                             <div className="h-8 w-20 bg-primary/10 rounded flex items-center justify-center text-[10px] font-bold text-primary border border-primary/20">
                                10 Qs
                             </div>
                             <div className="h-8 w-24 bg-primary/10 rounded flex items-center justify-center text-[10px] font-bold text-primary border border-primary/20">
                                Hard Mode
                             </div>
                        </div>
                    </div>
                )}
              </div>
            </CardContent>
          </BentoCard>

          {/* 2. CHAT: Interactive Bubble */}
          <BentoCard className="md:col-span-1 md:row-span-2" delay={0.2}>
            <CardContent className="p-6 h-full flex flex-col relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-blue-500/5 pointer-events-none" />
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold mb-2">Doc Chat</h3>
              <p className="text-sm text-muted-foreground mb-4">Ask your textbooks questions directly.</p>
              
              <div className="mt-auto space-y-3 relative z-10">
                <div className="bg-primary/10 p-3 rounded-2xl rounded-tl-none text-xs leading-relaxed shadow-sm">
                    Explain Quantum Entanglement.
                </div>
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                    className="bg-muted p-3 rounded-2xl rounded-tr-none text-xs ml-4 border border-border leading-relaxed shadow-sm"
                >
                    It's when particles become linked...
                </motion.div>
              </div>
            </CardContent>
          </BentoCard>

          {/* 3. PROJECTS: Folder Visualization */}
          <BentoCard className="md:col-span-1 md:row-span-1" delay={0.3}>
             <CardContent className="p-6 flex flex-col justify-between h-full relative overflow-hidden group">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500 mb-2">
                    <FolderKanban className="w-5 h-5" />
                </div>
                <div>
                     <h3 className="font-bold text-lg">Smart Projects</h3>
                     <p className="text-xs text-muted-foreground mt-1">Organize by subject.</p>
                </div>
                
                {/* Hover Effect: Files peeking out */}
                <div className="absolute right-4 bottom-4 w-12 h-10 bg-green-500/10 rounded-lg border-2 border-green-500/20 flex items-end justify-center pb-1 group-hover:scale-110 transition-transform">
                    <div className="w-10 h-8 bg-background rounded-t-md border-2 border-green-500/20 absolute -top-2 left-1 z-0" />
                    <div className="w-8 h-1 bg-green-500/40 rounded-full z-10" />
                </div>
             </CardContent>
          </BentoCard>

          {/* 4. SUMMARIES: Text Shrink Animation */}
          <BentoCard className="md:col-span-1 md:row-span-1" delay={0.4}>
            <CardContent className="p-6 flex flex-col justify-between h-full group">
                 <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 mb-2">
                    <FileText className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-lg">AI Summaries</h3>
                    <p className="text-xs text-muted-foreground mt-1">Digest complex topics.</p>
                </div>

                <div className="flex items-center gap-2 mt-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    <div className="w-6 h-8 border border-muted-foreground/30 rounded flex flex-col gap-1 p-1">
                         <div className="w-full h-0.5 bg-muted-foreground/30" />
                         <div className="w-full h-0.5 bg-muted-foreground/30" />
                         <div className="w-full h-0.5 bg-muted-foreground/30" />
                    </div>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <div className="w-6 h-8 border border-orange-500/30 bg-orange-500/5 rounded flex flex-col justify-center items-center p-1">
                        <div className="w-3 h-3 rounded-full bg-orange-500/20" />
                    </div>
                </div>
            </CardContent>
          </BentoCard>

          {/* 5. FLASHCARDS: 3D Flip Animation */}
          <BentoCard className="md:col-span-2 md:row-span-1" delay={0.5}>
            <CardContent className="p-6 flex items-center justify-between h-full relative group">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                        <Layers className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">Smart Flashcards</h3>
                        <p className="text-sm text-muted-foreground">Spaced repetition built-in.</p>
                    </div>
                </div>

                {/* The Flip Card */}
                <div className="w-24 h-32 relative perspective-1000 hidden sm:block">
                     <div className="relative w-full h-full transition-transform duration-700 transform-style-3d group-hover:rotate-y-180">
                        {/* Front */}
                        <div className="absolute inset-0 bg-background border border-purple-500/20 rounded-lg flex items-center justify-center shadow-sm backface-hidden">
                            <span className="text-xs font-bold text-purple-500">Front</span>
                        </div>
                        {/* Back */}
                        <div className="absolute inset-0 bg-purple-500 text-white rounded-lg flex items-center justify-center shadow-sm backface-hidden rotate-y-180">
                            <span className="text-xs font-bold">Back</span>
                        </div>
                     </div>
                </div>
            </CardContent>
          </BentoCard>

           {/* 6. ESSAY GRADER: Score Ring */}
           <BentoCard className="md:col-span-2 md:row-span-1" delay={0.6}>
            <CardContent className="p-6 flex items-center justify-between h-full relative">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500">
                        <PenTool className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">AI Essay Grader</h3>
                        <p className="text-sm text-muted-foreground">Instant scoring & feedback.</p>
                    </div>
                </div>

                {/* Score Circle */}
                <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-muted/20" />
                        <motion.circle 
                            cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-pink-500"
                            strokeDasharray={175}
                            strokeDashoffset={175}
                            whileInView={{ strokeDashoffset: 17 }} // 90% score
                            transition={{ duration: 1.5, ease: "easeOut" }}
                        />
                    </svg>
                    <span className="absolute text-sm font-bold text-pink-600">A-</span>
                </div>
            </CardContent>
          </BentoCard>

        </div>
      </div>
      
      {/* Utilities for 3D Transform */}
      <style jsx global>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .group-hover\\:rotate-y-180:hover { transform: rotateY(180deg); }
      `}</style>
    </section>
  );
}

// Icon for the summary card arrow
function ArrowRight({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
}