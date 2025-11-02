// src/app/(app)/layout.tsx
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
} from 'lucide-react';
import { useState } from 'react';
import { ChatbotDialog } from '@/components/ChatbotDialog';
import { PageProvider } from '@/contexts/PageContext'; // <-- 1. IMPORT

// ... (AppHeader component remains unchanged) ...
const AppHeader = () => {
  /* ... (no changes) ... */
  const { signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
       <div className="relative ml-auto flex items-center gap-2">
         <ThemeToggle />
         <Button variant="outline" size="sm" onClick={handleSignOut}>
           <LogOut className="w-4 h-4" />
           <span className="sr-only">Sign Out</span>
         </Button>
       </div>
    </header>
  );
};

// --- MODIFIED SidebarNav ---
const SidebarNav = () => {
  const pathname = usePathname();
  const navItems = [
    // --- Re-ordered and Renamed ---
    { href: '/documents', label: 'Documents', icon: FileText },
    { href: '/quizzes', label: 'Quizzes', icon: FileQuestion }, // <-- MODIFIED HREF
    { href: '/notes', label: 'Notes', icon: StickyNote },
    { href: '/flashcards', label: 'Flashcards', icon: Layers },
    { href: '/essay-grader', label: 'Essay Grader', icon: FileSignature },
    // --- End of Change ---
  ];

  return (
    <nav className="flex flex-col items-start gap-1 px-2 text-sm font-medium lg:px-4">
      {navItems.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
            // --- MODIFIED: Simplified Highlight logic ---
            (pathname === item.href || (item.href !== '/documents' && pathname.startsWith(item.href))) && 'bg-muted text-primary'
            // This now correctly highlights /quizzes, /notes, etc., when on sub-pages
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
};
// --- END MODIFICATION ---


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  return (
    // <-- 2. WRAP WITH PROVIDER -->
    <PageProvider>
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <aside className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r bg-background sm:flex">
          {/* ... (Sidebar content remains the same) ... */}
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/documents" className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-6 w-6 text-primary" />
              <span className="">QuizCraft</span>
            </Link>
          </div>
          <div className="flex-1 overflow-auto py-4">
            <SidebarNav />
          </div>
        </aside>
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-60">
          <AppHeader />
          <main className="flex-1 p-4 sm:px-6 sm:py-0">{children}</main>
        </div>

        {/* Chatbot Trigger Button */}
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            size="icon"
            className="rounded-full h-14 w-14 shadow-lg"
            onClick={() => setIsChatbotOpen(true)}
          >
            <MessageSquare className="h-6 w-6" />
            <span className="sr-only">Open AI Tutor</span>
          </Button>
        </div>

        {/* Chatbot Dialog Component (now inside provider) */}
        <ChatbotDialog isOpen={isChatbotOpen} onClose={() => setIsChatbotOpen(false)} />
      </div>
    </PageProvider>
    // <-- 3. END WRAPPER -->
  );
}