import React from "react";

export function AuroraBackground() {
  return (
    <div className="absolute inset-0 -z-20 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* --- MOBILE: Static Gradient (Zero Lag, Looks Beautiful) --- */}
      {/* This mimics the colors of your aurora but uses a simple CSS gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(76,29,149,0.1),transparent_100%)] md:hidden" />
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-primary/10 via-purple-500/5 to-transparent blur-3xl md:hidden" />
      
      {/* --- DESKTOP: Full Animation (Hardware Accelerated) --- */}
      <div className="hidden md:block">
        {/* Added 'translate-z-0' to force GPU acceleration */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] animate-aurora-1 opacity-50 will-change-transform translate-z-0" />
        <div className="absolute top-[20%] right-[-10%] w-[30%] h-[50%] rounded-full bg-blue-500/10 blur-[100px] animate-aurora-2 opacity-40 will-change-transform translate-z-0" />
        <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[40%] rounded-full bg-purple-500/15 blur-[120px] animate-aurora-3 opacity-40 will-change-transform translate-z-0" />
      </div>
    </div>
  );
}