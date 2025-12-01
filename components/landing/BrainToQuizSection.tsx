'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import { FileText, CheckCircle2, FileQuestion, BrainCircuit, GripVertical } from 'lucide-react';

export function BrainToQuizSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 1. Scroll Control
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  // 2. Manual Scrub Control (MotionValue)
  const manualProgress = useMotionValue(0.5); // Start in middle
  const [isDragging, setIsDragging] = useState(false);

  // 3. Sync Scroll to Manual ONLY if not dragging
  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (latest) => {
      if (!isDragging) {
        // Map scroll range [0.2, 0.8] to progress [0, 1]
        const adjusted = Math.min(Math.max((latest - 0.2) * 1.6, 0), 1);
        manualProgress.set(adjusted);
      }
    });
    return () => unsubscribe();
  }, [scrollYProgress, isDragging, manualProgress]);

  // Smooth out the motion
  const smoothProgress = useSpring(manualProgress, { stiffness: 300, damping: 30 });

  // Map progress to animations
  const opacity = useTransform(smoothProgress, [0, 0.2], [0, 1]);
  const scale = useTransform(smoothProgress, [0, 0.2], [0.8, 1]);
  
  const leftX = useTransform(smoothProgress, [0, 1], [-50, 0]);
  const rightX = useTransform(smoothProgress, [0, 1], [50, 0]);
  
  // Beam logic
  const beamOpacity = useTransform(smoothProgress, [0.2, 0.5, 0.8], [0, 1, 0]);
  const beamWidth = useTransform(smoothProgress, [0.2, 0.8], ["0%", "100%"]);

  return (
    <section ref={containerRef} className="py-32 overflow-hidden bg-muted/20 relative select-none">
      <div className="container mx-auto px-4">
        <motion.div style={{ opacity, scale }} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Turn Chaos into <span className="text-primary">Order</span></h2>
            <p className="text-muted-foreground text-lg">Drag the slider to see the magic happen.</p>
        </motion.div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 relative">
            
            {/* LEFT: CHAOS */}
            <motion.div style={{ x: leftX }} className="relative w-64 h-80">
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
                    </div>
                </motion.div>
                 <div className="absolute -bottom-4 -left-4 bg-red-100 dark:bg-red-900/20 text-red-600 px-3 py-1 rounded-full text-sm font-bold transform -rotate-12 z-20 border border-red-200">
                    Raw Notes
                </div>
            </motion.div>

            {/* CENTER: INTERACTIVE SLIDER BEAM */}
            <div className="relative w-48 h-24 flex items-center justify-center z-30">
                {/* The Track */}
                <div className="absolute inset-0 top-1/2 h-2 bg-muted rounded-full -translate-y-1/2 overflow-hidden">
                     <motion.div style={{ width: beamWidth }} className="h-full bg-gradient-to-r from-primary/50 to-primary" />
                </div>

                {/* The Draggable Handle */}
                <motion.div
                    drag="x"
                    dragConstraints={{ left: -100, right: 100 }}
                    dragElastic={0}
                    dragMomentum={false}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={() => setIsDragging(false)}
                    onDrag={(event, info) => {
                        // Convert drag x position (-100 to 100) to progress (0 to 1)
                        const newProgress = (info.point.x / 200) + 0.5; // Rough approximation logic needs rect bounds in real app
                        // Simplified: Just use drag delta to increment/decrement
                        const current = manualProgress.get();
                        manualProgress.set(Math.min(Math.max(current + (info.delta.x / 200), 0), 1));
                    }}
                    className="w-16 h-16 bg-background border-4 border-primary rounded-full shadow-2xl flex items-center justify-center cursor-grab active:cursor-grabbing relative z-40"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <BrainCircuit className="w-8 h-8 text-primary animate-pulse" />
                    <div className="absolute -bottom-8 text-xs font-bold text-muted-foreground whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
                        Drag Me
                    </div>
                </motion.div>
            </div>

            {/* RIGHT: ORDER */}
            <motion.div style={{ x: rightX }} className="relative w-64 h-80">
                 <div className="w-56 h-auto bg-white dark:bg-zinc-900 border-2 border-primary/20 shadow-2xl shadow-primary/10 rounded-xl p-6 relative group overflow-hidden">
                    <div className="absolute top-0 left-[-150%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 animate-[shimmer_3s_infinite]" />
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <span className="font-bold">Quiz Ready</span>
                    </div>
                    <div className="space-y-4">
                        <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                            <div className="h-2 bg-muted-foreground/20 rounded w-full" />
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                            <div className="h-2 bg-muted-foreground/20 rounded w-3/4" />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
      </div>
    </section>
  );
}