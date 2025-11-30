'use client';

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t py-6 bg-background">
      <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
        
        <div className="mb-4 md:mb-0 text-center md:text-left">
          <p>&copy; {new Date().getFullYear()} QuizCraft. All rights reserved.</p>
        </div>

        {/* Legal Links Section */}
        <div className="flex gap-6 mb-4 md:mb-0">
          <Link href="/legal/terms" className="hover:text-primary transition-colors">
            Terms of Service
          </Link>
          <Link href="/legal/privacy" className="hover:text-primary transition-colors">
            Privacy Policy
          </Link>
        </div>

        <div className="text-center md:text-right">
          <span>Contact: </span>
          <Link 
            href="mailto:sultanbusiness2026@gmail.com" 
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            sultanbusiness2026@gmail.com
          </Link>
        </div>
      </div>
    </footer>
  );
}