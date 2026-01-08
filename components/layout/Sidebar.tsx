// components/layout/Sidebar.tsx
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
  FileSignature,
  Settings,
  Sparkles
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navItems = [
  { href: '/dashboard', label: 'Command Center', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/documents', label: 'Knowledge Base', icon: FileText },
  { href: '/quizzes', label: 'Simulations', icon: FileQuestion },
  { href: '/notes', label: 'Neural Notes', icon: StickyNote },
  { href: '/recordings', label: 'Audio Logs', icon: Mic },
  { href: '/flashcards', label: 'Memory Bank', icon: Layers },
  { href: '/essay-grader', label: 'Analysis Engine', icon: FileSignature },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-4 top-4 bottom-4 z-40 hidden w-16 flex-col items-center rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-2xl sm:flex">
      {/* Logo Area */}
      <div className="flex h-16 items-center justify-center border-b border-white/5 w-full mb-2">
        <Link href="/dashboard" className="group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-all group-hover:bg-primary/20 group-hover:shadow-[0_0_15px_-3px_var(--primary)]">
            <Sparkles className="h-6 w-6 text-primary transition-transform group-hover:rotate-12" />
          </div>
        </Link>
      </div>

      {/* Navigation Items */}
      <TooltipProvider delayDuration={0}>
        <nav className="flex flex-1 flex-col items-center gap-3 px-2 py-4 w-full">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300',
                      isActive 
                        ? 'bg-primary/20 text-primary shadow-[0_0_10px_-2px_var(--primary)]' 
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full h-8 w-1 bg-primary rounded-r-full shadow-[0_0_8px_var(--primary)] animate-in fade-in slide-in-from-right-2" />
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover/90 backdrop-blur border-white/10 text-xs font-mono tracking-wider">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </TooltipProvider>

      {/* Bottom Actions */}
      <div className="flex flex-col items-center gap-3 p-4 w-full border-t border-white/5">
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Link href="/account" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-primary hover:bg-white/5">
                        <Settings className="h-5 w-5" />
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-mono text-xs">System Config</TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </div>
    </aside>
  );
}