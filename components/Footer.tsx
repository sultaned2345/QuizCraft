// src/components/Footer.tsx
import Link from 'next/link';
import Logo from '@/components/ui/Logo'; // FIXED: Default import (removed braces)
import { Separator } from '@/components/ui/separator';
import { Github, Twitter } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-muted/30 border-t pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          
          {/* Brand Column */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <Logo size="md" />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Transforming study materials into interactive mastery using AI. 
              Study smarter, not harder.
            </p>
            <div className="flex gap-4">
              <Link href="https://twitter.com/quizcraft" target="_blank" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="h-5 w-5" />
                <span className="sr-only">Twitter</span>
              </Link>
              <Link href="https://github.com/quizcraft" target="_blank" className="text-muted-foreground hover:text-primary transition-colors">
                <Github className="h-5 w-5" />
                <span className="sr-only">GitHub</span>
              </Link>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/features" className="hover:text-foreground transition-colors">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
              <li><Link href="/login" className="hover:text-foreground transition-colors">Login</Link></li>
              <li><Link href="/signup" className="hover:text-foreground transition-colors">Sign Up</Link></li>
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="font-semibold mb-4">Resources</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/support" className="hover:text-foreground transition-colors">Help Center</Link></li>
              <li><Link href="/guides" className="hover:text-foreground transition-colors">Study Guides</Link></li>
              <li><Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link></li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link href="/legal/privacy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/legal/dmca" className="hover:text-foreground transition-colors">
                  DMCA Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="mb-8" />

        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} QuizCraft LLC (Ras Al-Khaimah, UAE). All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}