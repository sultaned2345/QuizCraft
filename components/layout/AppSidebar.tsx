// components/layout/AppSidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  FileQuestion,
  StickyNote,
  Mic,
  Layers,
  Settings,
  Sparkles,
  LogOut,
  User
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/documents', label: 'Library', icon: FileText },
  { href: '/notes', label: 'Notes', icon: StickyNote },
  { href: '/quizzes', label: 'Quizzes', icon: FileQuestion },
  { href: '/flashcards', label: 'Flashcards', icon: Layers },
  { href: '/recordings', label: 'Recordings', icon: Mic },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { signOut, user } = useAuth();

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 w-16 flex flex-col items-center bg-black border-r border-white/10 py-6">
      {/* 1. Brand Icon */}
      <Link href="/dashboard" className="mb-8">
        <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center text-black hover:bg-zinc-200 transition-colors">
          <Sparkles className="h-5 w-5 fill-black" />
        </div>
      </Link>

      {/* 2. Navigation */}
      <nav className="flex-1 flex flex-col items-center gap-2 w-full px-2">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-md transition-all duration-200',
                      isActive
                        ? 'bg-zinc-800 text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900'
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

      {/* 3. Bottom Actions (Profile/Settings) */}
      <div className="flex flex-col items-center gap-3 mt-auto w-full">
        <div className="h-px w-8 bg-white/10 mb-1" />
        
        <TooltipProvider delayDuration={0}>
          {/* Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/profile"
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-md transition-all duration-200',
                  pathname.startsWith('/profile') 
                    ? 'bg-zinc-800 text-white' 
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900'
                )}
              >
                <Settings className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-zinc-900 border-white/10 text-xs font-medium text-zinc-300">
                Settings
            </TooltipContent>
          </Tooltip>

          {/* Logout */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => signOut()}
                className="flex h-10 w-10 items-center justify-center rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-zinc-900 border-white/10 text-xs font-medium text-zinc-300">
                Sign Out
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Avatar (Static) */}
        <div className="mt-2 h-8 w-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-xs text-zinc-400 font-medium">
            {user?.email?.[0].toUpperCase() || <User className="w-4 h-4" />}
        </div>
      </div>
    </aside>
  );
}