// src/components/Footer.tsx
'use client';

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t py-8 bg-background/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        
        {/* Copyright */}
        <p>&copy; {new Date().getFullYear()} QuizCraft. All rights reserved.</p>

        {/* Links */}
        <div className="flex items-center gap-6">
          <Link 
            href="/legal/terms" 
            className="hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            Terms of Service
          </Link>
          <Link 
            href="/legal/privacy" 
            className="hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
          
          <div className="flex items-center gap-2">
            <span>Support:</span>
            <Link 
              href="mailto:sultanbusiness2026@gmail.com" 
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              sultanbusiness2026@gmail.com
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
}