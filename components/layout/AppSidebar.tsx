'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Settings,
  Sparkles,
  LogOut,
  User,
  Plus,
  BookOpen
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AddDocumentDialog } from '@/components/AddDocumentDialog';

// TURBO AI: Focused Navigation
const navItems = [
  { href: '/dashboard', label: 'Library', icon: LayoutDashboard },
  { href: '/account', label: 'Settings', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { signOut, user } = useAuth();

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 w-16 flex flex-col items-center bg-zinc-950 border-r border-white/10 py-6">
      {/* 1. Brand Icon */}
      <Link href="/dashboard" className="mb-6">
        <div className="h-10 w-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary hover:bg-primary/30 transition-colors border border-primary/20">
          <BookOpen className="h-5 w-5" />
        </div>
      </Link>

      {/* 2. New Document Action */}
      <div className="mb-6">
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <AddDocumentDialog>
                        <button className="h-10 w-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-all">
                            <Plus className="h-5 w-5" />
                        </button>
                    </AddDocumentDialog>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-zinc-900 border-white/10 text-xs">
                    New Study Set
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </div>

      {/* 3. Main Navigation */}
      <nav className="flex-1 flex flex-col items-center gap-3 w-full px-2">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                        : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-zinc-900 border-white/10 text-xs font-medium text-zinc-300">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </nav>

      {/* 4. Bottom Actions (Logout/Profile) */}
      <div className="flex flex-col items-center gap-4 mt-auto w-full">
        <div className="h-px w-8 bg-white/10" />
        
        <TooltipProvider delayDuration={0}>
          {/* Logout */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => signOut()}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-zinc-900 border-white/10 text-xs font-medium text-zinc-300">
                Sign Out
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* User Avatar */}
        <Link href="/account">
            <div className="h-9 w-9 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-xs text-zinc-400 font-medium hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer">
                {user?.email?.[0].toUpperCase() || <User className="w-4 h-4" />}
            </div>
        </Link>
      </div>
    </aside>
  );
}