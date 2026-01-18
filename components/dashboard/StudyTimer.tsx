"use client";

import { Play, Pause, Zap } from "lucide-react";
import { useStudyTimer } from "@/hooks/useStudyTimer";
import { cn } from "@/lib/utils";

export function StudyTimer() {
  const { isActive, seconds, toggleTimer, formatTime } = useStudyTimer({ activityType: "general" });

  // Visual Calc for Circular Progress (Goal: 60 mins for daily session)
  const DAILY_GOAL_SECONDS = 3600; 
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(seconds / DAILY_GOAL_SECONDS, 1);
  const dashOffset = circumference - progress * circumference;

  return (
    <div className="relative group overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-pink-500/10 backdrop-blur-xl p-6 shadow-2xl transition-all hover:border-white/20">
      
      {/* Background Glow Effect */}
      <div className={cn(
        "absolute -top-20 -right-20 h-40 w-40 rounded-full bg-purple-500/20 blur-3xl transition-all duration-1000",
        isActive ? "opacity-100 scale-125" : "opacity-30 scale-100"
      )} />

      <div className="relative z-10 flex flex-col items-center justify-center space-y-4">
        <div className="flex items-center space-x-2 text-sm font-medium text-purple-200/80 uppercase tracking-widest">
          <Zap className={cn("w-4 h-4", isActive && "fill-yellow-400 text-yellow-400 animate-pulse")} />
          <span>Focus Session</span>
        </div>

        {/* Circular Timer Visualization */}
        <div className="relative flex items-center justify-center">
          {/* SVG Ring */}
          <svg className="w-40 h-40 transform -rotate-90">
            {/* Track */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              className="stroke-white/5"
              strokeWidth="8"
              fill="transparent"
            />
            {/* Progress Indicator */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              className="stroke-purple-500 transition-all duration-1000 ease-in-out"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 6px rgba(168, 85, 247, 0.5))" }}
            />
          </svg>

          {/* Time Text Center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn(
              "text-3xl font-bold font-mono text-white tracking-wider transition-all",
              isActive ? "scale-110 drop-shadow-lg" : "scale-100"
            )}>
              {formatTime(seconds)}
            </span>
            <span className="text-xs text-white/40 mt-1">
              {isActive ? "Tracking..." : "Paused"}
            </span>
          </div>
        </div>

        {/* Controls */}
        <button
          onClick={toggleTimer}
          className={cn(
            "flex items-center space-x-2 px-8 py-2.5 rounded-full font-medium transition-all duration-300 transform active:scale-95",
            isActive 
              ? "bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
              : "bg-white text-purple-900 hover:bg-purple-50 shadow-lg shadow-purple-500/20"
          )}
        >
          {isActive ? (
            <>
              <Pause className="w-4 h-4 fill-current" />
              <span>Pause Focus</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Start Focus</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}