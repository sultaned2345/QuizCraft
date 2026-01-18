'use client';

import { User } from '@supabase/supabase-js';
import { Sparkles, Zap, Battery, ShieldCheck } from 'lucide-react';

interface WelcomeHeroProps {
  user: User | null;
  streak?: number; // Added streak prop
}

export function WelcomeHero({ user, streak = 0 }: WelcomeHeroProps) {
  const date = new Date();
  const hour = date.getHours();
  
  let greeting = 'Systems Online';
  if (hour < 12) greeting = 'Good Morning';
  else if (hour < 18) greeting = 'Good Afternoon';
  else greeting = 'Good Evening';

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Operative';

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-card/50 via-card/30 to-transparent p-8 backdrop-blur-xl group">
      {/* Background Decorative Glow */}
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-[100px] group-hover:bg-primary/30 transition-colors duration-500" />
      
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-mono tracking-wider">
              <ShieldCheck className="w-3 h-3" />
              <span>SECURE CONN</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono tracking-wider">
              <Battery className="w-3 h-3" />
              <span>OPTIMAL</span>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">
            {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">{firstName}</span>.
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl">
            Your cognitive index is stable. Ready to resume data absorption?
          </p>
        </div>

        {/* Real Streak Display */}
        <div className="hidden md:block">
           <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 ${streak > 0 ? 'bg-primary/20 text-primary shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-muted/20 text-muted-foreground'}`}>
                 <Zap className={`w-5 h-5 ${streak > 0 ? 'fill-primary' : ''}`} />
              </div>
              <div>
                 <div className="text-xs text-muted-foreground font-mono uppercase">Current Streak</div>
                 <div className="text-xl font-bold font-mono">
                    {streak} {streak === 1 ? 'Day' : 'Days'}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}