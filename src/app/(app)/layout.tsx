// src/app/(app)/layout.tsx
// MODIFIED FILE

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  LogOut,
  FileQuestion,
  StickyNote,
  Layers,
  FileSignature,
  MessageSquare,
  FileText,
  User, // <-- 1. IMPORT USER ICON
  CreditCard, // <-- 2. IMPORT CREDITCARD ICON
} from 'lucide-react';
import { useState } from 'react';
import { ChatbotDialog } from '@/components/ChatbotDialog';
import { PageProvider } from '@/contexts/PageContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'; // <-- 3. IMPORT DROPDOWN

// --- 4. MODIFIED AppHeader ---
const AppHeader = () => {
  const { user, signOut } = useAuth(); // Get user
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <div className="relative ml-auto flex items-center gap-2">
        <ThemeToggle />
        {/* --- ADDED USER DROPDOWN --- */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="overflow-hidden rounded-full h-8 w-8"
            >
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">My Account</p>
                <p className="text-xs leading-none text-muted-foreground truncate max-w-40">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account">
                <CreditCard className="w-4 h-4 mr-2" />
                Usage & Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* --- END USER DROPDOWN --- */}
      </div>
    </header>
  );
};

// --- 5. MODIFIED SidebarNav ---
const SidebarNav = ({ onOpenChat }: { onOpenChat: () => void }) => {
  const pathname = usePathname();

  const navItems = [
    { href: '/documents', label: 'Documents', icon: FileText },
    { label: 'AI Tutor', icon: MessageSquare, action: onOpenChat },
    { href: '/quizzes', label: 'Quizzes', icon: FileQuestion },
    { href: '/notes', label: 'Notes', icon: StickyNote },
    { href: '/flashcards', label: 'Flashcards', icon: Layers },
    { href: '/essay-grader', label: 'Essay Grader', icon: FileSignature },
    // --- ADDED ACCOUNT LINK ---
    { href: '/account', label: 'Account', icon: CreditCard, isLast: true },
  ];

  return (
    <TooltipProvider delayDuration={0}>
      <nav className="flex flex-col h-full justify-between items-center gap-2 px-2 text-sm font-medium lg:px-4">
        {/* Main Nav Items */}
        <div className="flex flex-col items-center gap-2">
          {navItems
            .filter((item) => !item.isLast)
            .map((item) => {
              const isActive =
                item.href &&
                (pathname === item.href ||
                  (item.href === '/documents' &&
                    pathname.startsWith('/documents/')) ||
                  (item.href !== '/documents' && pathname.startsWith(item.href)));

              const itemClasses = cn(
                'flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-primary',
                isActive && 'bg-muted text-primary'
              );

              if (item.action) {
                return (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        className={itemClasses}
                        onClick={item.action}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="sr-only">{item.label}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    <Link href={item.href || '#'} className={itemClasses}>
                      <item.icon className="h-5 w-5" />
                      <span className="sr-only">{item.label}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
        </div>

        {/* Footer Nav Items (Account) */}
        <div className="flex flex-col items-center gap-2">
          {navItems
            .filter((item) => item.isLast)
            .map((item) => {
              const isActive = item.href && pathname.startsWith(item.href);
              const itemClasses = cn(
                'flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-primary',
                isActive && 'bg-muted text-primary'
              );
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    <Link href={item.href || '#'} className={itemClasses}>
                      <item.icon className="h-5 w-5" />
                      <span className="sr-only">{item.label}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
        </div>
      </nav>
    </TooltipProvider>
  );
};

// --- (Main Layout Component remains the same) ---
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  return (
    <PageProvider>
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <aside className="fixed inset-y-0 left-0 z-10 hidden w-20 flex-col border-r bg-background sm:flex">
          <div className="flex h-14 items-center justify-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link
              href="/documents"
              className="flex items-center justify-center gap-2 font-semibold"
            >
              <Sparkles className="h-6 w-6 text-primary" />
              <span className="sr-only">QuizCraft</span>
            </Link>
          </div>
          <div className="flex-1 overflow-auto py-4">
            <SidebarNav onOpenChat={() => setIsChatbotOpen(true)} />
          </div>
        </aside>

        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-20">
          <AppHeader />
          <main className="flex-1 p-4 sm:px-6 sm:py-0">{children}</main>
        </div>

        <ChatbotDialog
          isOpen={isChatbotOpen}
          onClose={() => setIsChatbotOpen(false)}
        />
      </div>
    </PageProvider>
  );
}