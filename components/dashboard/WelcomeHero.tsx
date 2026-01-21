// src/components/dashboard/WelcomeHero.tsx
'use client';

import { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { Zap, Settings2, Eye, EyeOff, Quote, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

interface WelcomeHeroProps {
  user: User | null;
  streak?: number;
}

export function WelcomeHero({ user, streak = 0 }: WelcomeHeroProps) {
  const [showStreak, setShowStreak] = useState(true);
  const [showQuote, setShowQuote] = useState(true);
  const [compactMode, setCompactMode] = useState(false);

  const date = new Date();
  const hour = date.getHours();
  
  let greeting = 'Hello';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';
  else greeting = 'Good evening';

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Friend';

  return (
    <div 
      className={`
        relative overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm transition-all duration-500
        ${compactMode ? 'p-6' : 'p-8 md:p-10'}
      `}
    >
      {/* Warm Background Wash (using your Primary - Baked Clay) */}
      <div className="absolute top-0 right-0 -mt-24 -mr-24 h-96 w-96 rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-6">
        <div className="flex-1 space-y-4">
          {/* Greeting - Using your Serif font (Merriweather) for the cozy feel */}
          <h1 className={`font-serif font-bold tracking-tight text-foreground transition-all duration-300 ${compactMode ? 'text-2xl' : 'text-3xl md:text-4xl'}`}>
            {greeting}, <span className="text-primary italic">{firstName}</span>.
          </h1>
          
          {/* Daily Quote */}
          {showQuote && !compactMode && (
            <div className="flex gap-4 max-w-xl animate-in fade-in duration-700">
               <div className="mt-1">
                 {/* Sage Green (Secondary) for the icon */}
                 <Quote className="w-6 h-6 text-secondary fill-secondary/20" />
               </div>
               <div>
                  <p className="text-muted-foreground text-lg italic leading-relaxed font-serif">
                    "The beautiful thing about learning is that no one can take it away from you."
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-2 uppercase tracking-wider font-sans font-semibold">
                    — B.B. King
                  </p>
               </div>
            </div>
          )}
          
          {!showQuote && !compactMode && (
             <p className="text-muted-foreground text-lg font-serif italic">
               Ready to continue your studies?
             </p>
          )}
        </div>

        {/* Right Side: Settings & Streak */}
        <div className="flex flex-col items-end gap-3">
          {/* Settings Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full">
                <Settings2 className="w-4 h-4" />
                <span className="sr-only">Settings</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-serif">Dashboard View</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={showStreak} onCheckedChange={setShowStreak}>
                <Zap className="w-4 h-4 mr-2 text-primary" /> Show Streak
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={showQuote} onCheckedChange={setShowQuote}>
                <BookOpen className="w-4 h-4 mr-2 text-secondary" /> Daily Quote
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={compactMode} onCheckedChange={setCompactMode}>
                {compactMode ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />} 
                Compact Mode
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Warm Streak Display */}
          {showStreak && (
            <div className={`
              flex items-center gap-3 rounded-xl border border-border bg-background/50 backdrop-blur-sm
              ${compactMode ? 'p-2 pr-4' : 'p-3 pr-5'}
            `}>
              <div className={`
                flex items-center justify-center rounded-lg transition-colors
                ${streak > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}
                ${compactMode ? 'h-8 w-8' : 'h-10 w-10'}
              `}>
                <Zap className={`fill-current ${compactMode ? 'w-4 h-4' : 'w-5 h-5'}`} />
              </div>
              
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 font-sans">
                  Daily Streak
                </span>
                <span className={`font-bold tabular-nums leading-none font-serif text-foreground ${compactMode ? 'text-lg' : 'text-xl'}`}>
                  {streak} <span className="text-sm font-sans font-normal text-muted-foreground">days</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}