// src/app/legal/layout.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, FileText, ArrowLeft, Lock } from 'lucide-react';

interface LegalLayoutProps {
  children: React.ReactNode;
}

export default function LegalLayout({ children }: LegalLayoutProps) {
  const pathname = usePathname();

  const navItems = [
    {
      title: "Terms of Service",
      href: "/legal/terms",
      icon: <FileText className="w-4 h-4 mr-2" />,
    },
    {
      title: "Privacy Policy",
      href: "/legal/privacy",
      icon: <Lock className="w-4 h-4 mr-2" />,
    },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Link href="/" className="flex items-center gap-2 font-semibold mr-6">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          <div className="flex items-center gap-2 text-muted-foreground border-l pl-6">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">Legal Center</span>
          </div>
        </div>
      </div>

      <div className="container flex-1 items-start md:grid md:grid-cols-[240px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10 py-8">
        {/* Sidebar Navigation */}
        <aside className="fixed top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 overflow-y-auto border-r md:sticky md:block">
          <ScrollArea className="py-6 pr-6 lg:py-8">
            <h4 className="mb-4 text-sm font-semibold tracking-tight px-2">
              Legal Documents
            </h4>
            <nav className="flex flex-col space-y-1">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <span
                    className={cn(
                      "flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors",
                      pathname === item.href
                        ? "bg-primary/10 text-primary hover:bg-primary/15"
                        : "transparent"
                    )}
                  >
                    {item.icon}
                    {item.title}
                  </span>
                </Link>
              ))}
            </nav>
            <div className="mt-8 px-2">
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Support
              </h4>
              <p className="text-sm text-muted-foreground mb-4">
                Questions about these documents?
              </p>
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link href="mailto:sultanbusiness2026@gmail.com">
                  Contact Legal
                </Link>
              </Button>
            </div>
          </ScrollArea>
        </aside>

        {/* Main Content Area */}
        <main className="relative py-6 lg:gap-10 lg:py-8">
           {children}
        </main>
      </div>
    </div>
  );
}