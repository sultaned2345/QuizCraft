// components/layout/HUDHeader.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { User, LogOut, CreditCard, Activity, Zap } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function HUDHeader() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 bg-background/50 backdrop-blur-md px-6 border-b border-white/5">
      
      {/* Left: Status Indicators (Decorative) */}
      <div className="hidden md:flex items-center gap-6 text-xs font-mono text-muted-foreground">
         <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_var(--color-green-500)] animate-pulse" />
            <span className="tracking-widest opacity-70">SYSTEM ONLINE</span>
         </div>
         <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-primary" />
            <span className="opacity-70">LATENCY: 12ms</span>
         </div>
      </div>

      <div className="ml-auto flex items-center gap-4">
        {/* Gamification Stats (Placeholder) */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/40 border border-white/5">
            <Zap className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-mono font-bold text-foreground">12 DAY STREAK</span>
        </div>

        <div className="h-6 w-px bg-white/10 mx-2" />

        <ThemeToggle />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative overflow-hidden rounded-full h-9 w-9 border border-white/10 bg-white/5 hover:bg-primary/20 hover:border-primary/50 transition-all"
            >
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card/90 backdrop-blur-xl border-white/10">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-foreground">My Account</p>
                <p className="text-xs leading-none text-muted-foreground truncate font-mono">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account" className="cursor-pointer">
                <CreditCard className="w-4 h-4 mr-2" />
                Usage & Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}