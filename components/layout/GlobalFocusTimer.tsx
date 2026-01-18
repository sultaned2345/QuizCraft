'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function GlobalFocusTimer() {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes default
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      // Optional: Play sound here
    }

    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(isBreak ? 5 * 60 : 25 * 60);
  };

  const toggleMode = () => {
    const newModeIsBreak = !isBreak;
    setIsBreak(newModeIsBreak);
    setTimeLeft(newModeIsBreak ? 5 * 60 : 25 * 60);
    setIsActive(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Progress percentage for the ring
  const totalTime = isBreak ? 5 * 60 : 25 * 60;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  return (
    <div className="flex items-center gap-2 bg-background/50 border border-border/40 rounded-full px-1 py-1 pr-3 shadow-sm backdrop-blur-md">
      {/* Play/Pause Button with Progress Ring */}
      <div className="relative h-8 w-8 flex items-center justify-center">
        <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 36 36">
          {/* Background Ring */}
          <path
            className="text-muted/20"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          {/* Progress Ring */}
          <path
            className={`${isBreak ? 'text-green-500' : 'text-primary'} transition-all duration-1000 ease-linear`}
            strokeDasharray={`${progress}, 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
        </svg>
        <button
          onClick={toggleTimer}
          className="relative z-10 h-6 w-6 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors"
        >
          {isActive ? (
            <Pause className="h-3 w-3 fill-current" />
          ) : (
            <Play className="h-3 w-3 fill-current ml-0.5" />
          )}
        </button>
      </div>

      {/* Time Display */}
      <div className="flex flex-col items-start min-w-[3.5rem]">
        <span className={`text-sm font-mono font-bold leading-none ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
          {formatTime(timeLeft)}
        </span>
        <span 
            onClick={toggleMode}
            className="text-[10px] uppercase font-bold text-muted-foreground hover:text-primary cursor-pointer transition-colors"
        >
          {isBreak ? 'Break' : 'Focus'}
        </span>
      </div>

      {/* Quick Reset (Visible on hover or when paused) */}
      {!isActive && timeLeft !== (isBreak ? 5 * 60 : 25 * 60) && (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={resetTimer}>
                      <RotateCcw className="h-3 w-3 text-muted-foreground" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Reset Timer</TooltipContent>
            </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}