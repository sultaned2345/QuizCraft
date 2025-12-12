import React from "react";

export function AuroraBackground() {
  return (
    <div className="absolute inset-0 -z-20 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] animate-aurora-1 opacity-50 will-change-transform" />
      <div className="absolute top-[20%] right-[-10%] w-[30%] h-[50%] rounded-full bg-blue-500/10 blur-[100px] animate-aurora-2 opacity-40 will-change-transform" />
      <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[40%] rounded-full bg-purple-500/15 blur-[120px] animate-aurora-3 opacity-40 will-change-transform" />
    </div>
  );
}