// src/components/LandingHeader.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';

export function LandingHeader() {
  const { user, loading } = useAuth();
  const router = useRouter();

  return (
    // OPTIMIZATION: Removed 'backdrop-blur-sm' to fix scrolling lag.
    // Switched to 'bg-background/95' which provides a clean look without the heavy GPU cost.
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 border-border/40">
      <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="bg-primary text-primary-foreground p-1 rounded-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">QuizCraft</span>
        </Link>
        
        <nav className="flex items-center gap-4">
          <ThemeToggle />
          {!loading && (
            <>
              {user ? (
                <Button onClick={() => router.push("/documents")}>
                  My Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" asChild className="hidden sm:inline-flex">
                    <Link href="/login">Log In</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/signup">Get Started</Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}