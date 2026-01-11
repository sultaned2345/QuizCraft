// src/components/layout/AppSidebar.tsx
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  FileText, 
  BrainCircuit, 
  Zap, 
  Settings, 
  LogOut,
  Layers,
  GraduationCap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const navigation = [
  { name: 'Workspace', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Library', href: '/documents', icon: FileText },
  { name: 'Study Plans', href: '/projects', icon: Layers }, // Renamed for clarity
  { name: 'Flashcards', href: '/flashcards', icon: Zap },
  { name: 'Quizzes', href: '/quizzes', icon: BrainCircuit },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    // FIX: Changed fixed colors (bg-zinc-900) to semantic colors (bg-card/bg-background)
    <div className="flex flex-col h-full w-[250px] border-r border-border bg-card text-card-foreground transition-colors duration-300">
      
      {/* Logo Area */}
      <div className="p-6 pb-2">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight">QuizCraft</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                isActive 
                  ? "bg-primary/10 text-primary shadow-sm" 
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "w-4 h-4 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              )} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Profile Actions */}
      <div className="p-4 border-t border-border mt-auto">
        <Link 
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all"
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
        <button 
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-all mt-1 text-left"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}