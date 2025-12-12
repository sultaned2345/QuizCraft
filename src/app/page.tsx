'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic"; // 1. IMPORT DYNAMIC
import { LandingHeader } from "@/components/LandingHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, Sparkles, User, CheckCircle2, Smartphone } from "lucide-react";
import { AuroraBackground } from "@/components/landing/AuroraBackground";
import { TestimonialCard } from "@/components/landing/TestimonialCard";

// --- 2. LAZY LOAD HEAVY COMPONENTS ---
// This splits the code. The browser won't download these massive files 
// until the user actually sees the page, saving huge amounts of bandwidth and CPU.

const BentoGrid = dynamic(
  () => import("@/components/landing/BentoGrid").then((mod) => mod.BentoGrid),
  { 
    loading: () => <div className="h-[600px] w-full bg-muted/5 animate-pulse rounded-3xl" />,
    ssr: false // Disable SSR for smoother initial load
  }
);

const BrainToQuizSection = dynamic(
  () => import("@/components/landing/BrainToQuizSection").then((mod) => mod.BrainToQuizSection),
  { 
    loading: () => <div className="h-[400px] w-full bg-muted/5 animate-pulse rounded-3xl" />,
    ssr: false 
  }
);

const Typewriter = dynamic(
  () => import("@/components/landing/Typewriter").then((mod) => mod.Typewriter),
  { ssr: false }
);

const SpotlightCursor = dynamic(
  () => import("@/components/landing/SpotlightCursor").then((mod) => mod.SpotlightCursor),
  { ssr: false }
);

// --- CONSTANTS ---
const AURORA_TEXT_CLASS = "text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-blue-600 font-extrabold";

export default function LandingPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const handleSmartStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) router.push(`/signup?email=${encodeURIComponent(email)}`);
    else router.push('/signup');
  };

  return (
    <div className="flex flex-col min-h-screen font-sans relative selection:bg-primary/20 overflow-x-hidden">
      <SpotlightCursor />
      <LandingHeader />

      <main className="flex-1 relative">
        <AuroraBackground />

        {/* Hero Section - Optimized with 'will-change' hint */}
        <section className="relative py-20 md:py-32 overflow-hidden will-change-transform">
          <div className="container mx-auto px-4 md:px-6 text-center z-10 relative">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-background/80 px-4 py-1.5 text-sm font-medium text-primary mb-8 shadow-sm backdrop-blur-sm">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              <span>Now with AI Essay Grading</span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-foreground mb-8 max-w-6xl mx-auto leading-[1.1] drop-shadow-sm">
              Turn <span className={AURORA_TEXT_CLASS}>Notes</span> into <br />
              <Typewriter />
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
              Stop highlighting endless PDFs. Transform your raw study materials into 
              interactive quizzes and flashcards instantly.
            </p>

            <form onSubmit={handleSmartStart} className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
              <Input 
                type="email" 
                placeholder="Enter your email..." 
                className="h-14 rounded-full px-6 text-lg bg-background/60 border-primary/20 shadow-lg focus-visible:ring-primary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button size="lg" type="submit" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 hover:scale-105 transition-all w-full sm:w-auto">
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </form>
          </div>
        </section>

        {/* Heavy Sections are now Lazy Loaded */}
        <BrainToQuizSection />
        <BentoGrid />

        {/* Testimonials - Simplified rendering */}
        <section className="py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Don't just study. <span className={AURORA_TEXT_CLASS}>Understand.</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <TestimonialCard quote="I used to spend 5 hours making flashcards. Yesterday I did it in 3 minutes." name="Sarah J." title="University Student" />
              <TestimonialCard quote="QuizCraft caught nuances in my History lectures that I completely missed." name="Michael B." title="Grad Student" />
              <TestimonialCard quote="Works perfectly for technical Engineering PDFs. Handles formulas better than any other tool." name="David L." title="Engineering Major" />
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24 bg-muted/20">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            </div>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-lg">Is QuizCraft free?</AccordionTrigger>
                <AccordionContent>Yes! Free forever for up to 3 documents a month.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger className="text-lg">Can I trust the AI?</AccordionTrigger>
                <AccordionContent>We always cite the page number so you can verify facts instantly.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                 <AccordionTrigger className="text-lg flex gap-2 items-center"><Smartphone className="w-5 h-5" /> Does it work on mobile?</AccordionTrigger>
                <AccordionContent>Absolutely. QuizCraft is fully responsive.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 relative overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
            <h2 className="text-4xl md:text-6xl font-bold mb-8 tracking-tight">
              Ready to <span className={AURORA_TEXT_CLASS}>upgrade your grades</span>?
            </h2>
            <div className="flex flex-col items-center justify-center gap-4">
              <Button size="lg" className="h-14 px-10 rounded-full text-xl shadow-2xl hover:scale-105 transition-transform" asChild>
                <Link href="/signup">Get Started Now <ArrowRight className="ml-2 h-6 w-6" /></Link>
              </Button>
              <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Free Plan Available</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Cancel Anytime</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}