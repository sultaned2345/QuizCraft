'use client';

import { motion } from "framer-motion";
import { BrainCircuit, MessageSquare, Layers, Sparkles, TrendingUp, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
              
              {/* Mock UI Element */}
              <div className="mt-8 bg-background/50 rounded-lg p-4 border border-border/50 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-mono text-muted-foreground">Processing...</span>
                </div>
                <div className="space-y-2">
                    <div className="h-2 bg-primary/20 rounded w-3/4" />
                    <div className="h-2 bg-primary/10 rounded w-1/2" />
                    <div className="h-2 bg-primary/10 rounded w-5/6" />
                </div>
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
                <div className="bg-primary/10 p-2 rounded-lg rounded-tl-none text-xs">
                    What is the mitochondria?
                </div>
                <div className="bg-muted p-2 rounded-lg rounded-tr-none text-xs ml-4 border border-border">
                    The powerhouse of the cell.
                </div>
              </div>
            </CardContent>
          </BentoCard>

          {/* Stat: Analytics (Small) */}
          <BentoCard className="md:col-span-1 md:row-span-1" delay={0.3}>
             <CardContent className="p-6 flex flex-col justify-center h-full">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-500/10 text-green-500 rounded-md"><TrendingUp className="w-4 h-4" /></div>
                    <span className="font-bold text-xl">85%</span>
                </div>
                <p className="text-sm text-muted-foreground">Average Grade Improvement</p>
             </CardContent>
          </BentoCard>

          {/* Stat: Streak (Small) */}
          <BentoCard className="md:col-span-1 md:row-span-1" delay={0.4}>
            <CardContent className="p-6 flex flex-col justify-center h-full">
                 <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-orange-500/10 text-orange-500 rounded-md"><Sparkles className="w-4 h-4" /></div>
                    <span className="font-bold text-xl">12 Days</span>
                </div>
                <p className="text-sm text-muted-foreground">Study Streak</p>
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

           {/* Feature: Study Planner (Wide) */}
           <BentoCard className="md:col-span-2 md:row-span-1" delay={0.6}>
            <CardContent className="p-6 flex items-center gap-6 h-full">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500">
                    <Calendar className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-xl font-bold">Auto-Scheduling</h3>
                    <p className="text-sm text-muted-foreground">We plan your study sessions for you based on your exam dates.</p>
                </div>
            </CardContent>
          </BentoCard>

        </div>
      </div>
    </section>
  );
}