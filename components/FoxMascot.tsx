"use client";

import React, { useEffect, useState } from "react";
import Lottie, { LottieComponentProps } from "lottie-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// --- INSTRUCTIONS ---
// 1. Go to LottieFiles (https://lottiefiles.com/search?q=cute+fox&category=animations)
// 2. Download a free "Fox" JSON file.
// 3. Rename it to "fox-hero.json" and place it in your "public/lottie/" folder (create the folder if needed).
// --------------------

interface FoxMascotProps {
  className?: string;
  mood?: "happy" | "thinking" | "sleeping"; // For future expansion
}

export function FoxMascot({ className, mood = "happy" }: FoxMascotProps) {
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    // We load the JSON asynchronously so it doesn't bloat the initial bundle
    // Make sure you have the file at: public/lottie/fox-hero.json
    fetch("/lottie/fox-hero.json")
      .then((res) => {
        if (!res.ok) throw new Error("Fox animation not found");
        return res.json();
      })
      .then((data) => setAnimationData(data))
      .catch((err) => {
        console.warn("Fox Mascot: Could not load animation. Did you add public/lottie/fox-hero.json?", err);
      });
  }, []);

  if (!animationData) {
    // Fallback: A cute static placeholder while loading or if missing
    return (
      <div className={cn("flex items-center justify-center bg-orange-100 rounded-full", className)}>
         <span className="text-4xl">🦊</span>
      </div>
    );
  }

  return (
    <motion.div
      className={cn("relative z-10 pointer-events-none", className)}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Floating Animation Wrapper */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
      >
        <Lottie 
          animationData={animationData} 
          loop={true} 
          className="w-full h-full drop-shadow-2xl"
        />
      </motion.div>
    </motion.div>
  );
}