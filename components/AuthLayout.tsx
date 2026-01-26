'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { SpotlightCursor } from "@/components/landing/SpotlightCursor";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2 font-sans bg-background overflow-hidden">
       {/* Global Effects */}
       <SpotlightCursor />

       {/* LEFT COLUMN: Form Container */}
       <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative bg-background/50 backdrop-blur-sm h-full">
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
        <div className="mx-auto w-full max-w-sm relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
           {children}
        </div>
      </div>

      {/* RIGHT COLUMN: Brand/Testimonial (Hidden on mobile) */}
      <div className="hidden lg:flex flex-col items-center justify-center relative p-10 bg-muted/20 text-foreground border-l border-border/40">
        {/* Background Decorative Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl opacity-50" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl opacity-50" />
        </div>

        <div className="flex flex-col items-center justify-center max-w-lg text-center z-10">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 mb-12 hover:opacity-80 transition-opacity">
                <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-3.5 rounded-xl shadow-lg shadow-primary/20">
                    <BookOpen className="w-8 h-8" />
                </div>
                <span className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                    QuizCraft
                </span>
            </Link>
            
            {/* Testimonial */}
            <div className="p-8 rounded-2xl bg-card/40 backdrop-blur-md border border-border/50 shadow-sm">
                <p className="text-xl italic text-foreground/80 leading-relaxed font-serif">
                    &ldquo;The AI grading feature saved me hours of manual review. It's like having a personal tutor available 24/7.&rdquo;
                </p>
                
                <div className="flex items-center justify-center gap-4 mt-8">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                       M
                    </div>
                    <div className="text-left">
                        <p className="font-semibold text-foreground text-lg">Marcus T.</p>
                        <p className="text-sm text-muted-foreground">Medical Student</p>
                    </div>
                </div>
            </div>
            
            {/* Floating Badges (Visual interest) */}
            <div className="mt-12 flex gap-3 opacity-70">
                <div className="px-3 py-1 rounded-full bg-background border text-xs font-medium text-muted-foreground">
                    ⚡ Instant Quizzes
                </div>
                <div className="px-3 py-1 rounded-full bg-background border text-xs font-medium text-muted-foreground">
                    📚 Smart Notes
                </div>
                <div className="px-3 py-1 rounded-full bg-background border text-xs font-medium text-muted-foreground">
                    🎯 AI Grading
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}