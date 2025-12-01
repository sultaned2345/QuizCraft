'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { FileText, CheckCircle2, FileQuestion, BrainCircuit } from 'lucide-react';

export function BrainToQuizSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  // Animations based on scroll progress
  const opacity = useTransform(scrollYProgress, [0.2, 0.5], [0, 1]);
  const scale = useTransform(scrollYProgress, [0.2, 0.5], [0.8, 1]);
  
  const leftX = useTransform(scrollYProgress, [0.2, 0.6], [-100, 0]);
  const rightX = useTransform(scrollYProgress, [0.2, 0.6], [100, 0]);
  
  // The "Beam" animation
  const beamOpacity = useTransform(scrollYProgress, [0.4, 0.6, 0.8], [0, 1, 0]);
  const beamWidth = useTransform(scrollYProgress, [0.4, 0.8], ["0%", "100%"]);

  return (
    <section ref={containerRef} className="py-32 overflow-hidden bg-muted/20 relative">
      <div className="container mx-auto px-4">
        <motion.div 
            style={{ opacity, scale }}
            className="text-center mb-16"
        >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Turn Chaos into <span className="text-primary">Order</span></h2>
            <p className="text-muted-foreground text-lg">Stop drowning in PDFs. Start mastering them.</p>
        </motion.div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 relative">
            
            {/* LEFT SIDE: CHAOS */}
            <motion.div 
                style={{ x: leftX }}
                className="relative w-64 h-80"
            >
                {/* Scattered papers with SHAKE animation */}
                <motion.div 
                    animate={{ rotate: [-6, -8, -4, -6] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="absolute top-0 left-0 w-48 h-64 bg-white dark:bg-zinc-800 border shadow-lg rounded-lg p-4 z-10 opacity-90"
                >
                    <FileText className="w-8 h-8 text-muted-foreground mb-4" />
                    <div className="space-y-2">
                        <div className="h-2 bg-muted rounded w-full" />
                        <div className="h-2 bg-muted rounded w-5/6" />
                        <div className="h-2 bg-muted rounded w-full" />
                        <div className="h-2 bg-muted rounded w-4/6" />
                    </div>
                </motion.div>
                
                {/* More drastic rotation for the background paper */}
                <div className="absolute top-4 left-8 w-48 h-64 bg-white dark:bg-zinc-800 border shadow-md rounded-lg p-4 transform rotate-[20deg] z-0 opacity-70">
                     <div className="space-y-2 mt-8">
                        <div className="h-2 bg-muted rounded w-full" />
                        <div className="h-2 bg-muted rounded w-3/4" />
                    </div>
                </div>
                
                 <div className="absolute -bottom-4 -left-4 bg-red-100 dark:bg-red-900/20 text-red-600 px-3 py-1 rounded-full text-sm font-bold transform -rotate-12 z-20 border border-red-200 shadow-sm">
                    Raw Notes
                </div>
            </motion.div>

            {/* CENTER: THE AI ENGINE */}
            <div className="relative w-32 h-32 flex items-center justify-center z-20">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                <div className="bg-background border border-primary/30 rounded-2xl p-6 shadow-2xl relative">
                    <BrainCircuit className="w-12 h-12 text-primary animate-pulse" />
                </div>
                
                {/* Connecting Beam */}
                <motion.div 
                    style={{ opacity: beamOpacity, width: beamWidth }}
                    className="absolute top-1/2 left-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-transparent via-primary to-transparent -z-10"
                />
            </div>

            {/* RIGHT SIDE: ORDER */}
            <motion.div 
                style={{ x: rightX }}
                className="relative w-64 h-80"
            >
                 <div className="w-56 h-auto bg-white dark:bg-zinc-900 border-2 border-primary/20 shadow-2xl shadow-primary/10 rounded-xl p-6 transform hover:scale-105 transition-transform duration-300 overflow-hidden relative group">
                    
                    {/* SHINE EFFECT */}
                    <div className="absolute top-0 left-[-150%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 animate-[shimmer_3s_infinite]" />

                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <span className="font-bold">Quiz Ready</span>
                    </div>

                    <div className="space-y-4">
                        <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                            <div className="flex items-center gap-2 mb-2">
                                <FileQuestion className="w-4 h-4 text-primary" />
                                <span className="text-xs font-semibold">Question 1</span>
                            </div>
                            <div className="h-2 bg-muted-foreground/20 rounded w-full" />
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                             <div className="flex items-center gap-2 mb-2">
                                <FileQuestion className="w-4 h-4 text-primary" />
                                <span className="text-xs font-semibold">Question 2</span>
                            </div>
                            <div className="h-2 bg-muted-foreground/20 rounded w-3/4" />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
      </div>
      
      {/* Add Shimmer Keyframe */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { left: -150%; }
          50% { left: 150%; }
          100% { left: 150%; }
        }
      `}</style>
    </section>
  );
}