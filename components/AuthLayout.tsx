'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SpotlightCursor } from "@/components/landing/SpotlightCursor";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="w-full min-h-screen flex items-center justify-center font-sans bg-background overflow-hidden relative">
       {/* Global Effects */}
       <SpotlightCursor />

       {/* Background decorative elements to keep it from looking too empty */}
       <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl opacity-30" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl opacity-30" />
       </div>

       {/* Back Button */}
       <Link 
            href="/" 
            className="absolute top-8 left-8 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors z-20 group"
        >
           <div className="p-2 rounded-full bg-muted/50 group-hover:bg-primary/10 transition-colors">
             <ArrowLeft className="w-4 h-4" /> 
           </div>
           <span className="text-sm font-medium">Back to Home</span>
       </Link>

       {/* Content Wrapper */}
       <div className="w-full max-w-lg px-4 relative z-10 animate-in fade-in zoom-in-95 duration-500">
           {children}
       </div>
    </div>
  );
}