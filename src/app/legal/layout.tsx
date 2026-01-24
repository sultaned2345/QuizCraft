// src/app/legal/layout.tsx
import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import Logo from '@/components/ui/Logo'; // FIXED: Default import (removed braces)

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Simple Legal Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Logo size="sm" />
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content Area - Centered & Readable */}
      <main className="flex-1 py-12 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl w-full">
            {children}
        </div>
      </main>

      {/* Simple Footer for Legal Pages */}
      <footer className="py-8 text-center text-sm text-muted-foreground border-t">
        <p>&copy; {new Date().getFullYear()} QuizCraft. All rights reserved.</p>
        <div className="flex justify-center gap-4 mt-2">
            <Link href="/legal/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link href="/legal/terms" className="hover:text-primary transition-colors">Terms</Link>
        </div>
      </footer>
    </div>
  );
}