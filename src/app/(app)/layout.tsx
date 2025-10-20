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
  MessageSquare, // Import the chat icon
} from 'lucide-react';
import { useState } from 'react'; // Import useState
import { ChatbotDialog } from '@/components/ChatbotDialog'; // Import the new chatbot component

// Reusable Header for the authenticated layout
const AppHeader = () => {
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

// Sidebar Navigation Component
const SidebarNav = () => {
  const pathname = usePathname();
  const navItems = [
    { href: '/dashboard', label: 'Quizzes', icon: FileQuestion },
    { href: '/notes', label: 'Notes', icon: StickyNote },
    { href: '/flashcards', label: 'Flashcards', icon: Layers },
    { href: '/essay-grader', label: 'Essay Grader', icon: FileSignature },
  ];

  return (
    <nav className="flex flex-col items-start gap-1 px-2 text-sm font-medium lg:px-4">
      {navItems.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
            pathname === item.href && 'bg-muted text-primary'
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r bg-background sm:flex">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
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

      {/* Chatbot Dialog Component */}
      <ChatbotDialog isOpen={isChatbotOpen} onClose={() => setIsChatbotOpen(false)} />
    </div>
  );
}