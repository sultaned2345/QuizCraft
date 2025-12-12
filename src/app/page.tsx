'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LandingHeader } from "@/components/LandingHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, Sparkles, CheckCircle2, Download, Globe, Smartphone } from "lucide-react";
import { toast } from "@/hooks/use-toast"; 

// --- New Components ---
import { BentoGrid } from "@/components/landing/BentoGrid";
import { BrainToQuizSection } from "@/components/landing/BrainToQuizSection";
import { SpotlightCursor } from "@/components/landing/SpotlightCursor";
import { Typewriter } from "@/components/landing/Typewriter";
import { AuroraBackground } from "@/components/landing/AuroraBackground";
import { TestimonialCard } from "@/components/landing/TestimonialCard";

// --- Constants ---
const AURORA_TEXT_CLASS = "text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-blue-600 font-extrabold";

export default function LandingPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const handleSmartStart = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (email && !emailRegex.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    if (email) {
      router.push(`/signup?email=${encodeURIComponent(email)}`);
    } else {
      router.push('/signup');
    }
  };

  return (
    <div className="flex flex-col min-h-screen font-sans relative selection:bg-primary/20">
      {/* 1. Spotlight Effect */}
      <SpotlightCursor />
      
      {/* 2. Sticky/Glass Header */}
      <LandingHeader />

      <main className="flex-1 relative">
        <AuroraBackground />

        {/* Hero Section */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 text-center z-10 relative">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-background/50 backdrop-blur-md px-4 py-1.5 text-sm font-medium text-primary mb-8 shadow-sm hover:bg-background/80 transition-colors">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              <span>Now with AI Essay Grading</span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-foreground mb-8 max-w-6xl mx-auto leading-[1.1] drop-shadow-sm">
              Turn <span className={AURORA_TEXT_CLASS}>Notes</span> into <br />
              {/* 3. Typewriter Animation */}
              <Typewriter />
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
              Stop highlighting endless PDFs. Transform your raw study materials into 
              interactive quizzes and flashcards instantly.
            </p>

            {/* 4. Smart Form Pre-fill */}
            <form onSubmit={handleSmartStart} className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
              <Input 
                type="email" 
                name="email"
                placeholder="Enter your email..." 
                className="h-14 rounded-full px-6 text-lg bg-background/50 backdrop-blur-sm border-primary/20 shadow-lg focus-visible:ring-primary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email address for signup"
                required
              />
              <Button size="lg" type="submit" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-105 w-full sm:w-auto">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </form>
          </div>
        </section>

        {/* 5. Interactive Brain-to-Quiz Animation */}
        <BrainToQuizSection />

        {/* 6. Deep-Linked Bento Grid */}
        <BentoGrid />

        {/* Testimonials */}
        <section className="py-24 bg-transparent">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Don't just study. <span className={AURORA_TEXT_CLASS}>Understand.</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">See what other learners are saying about QuizCraft.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <TestimonialCard 
                quote="I used to spend 5 hours making flashcards for Biology. Yesterday I did it in 3 minutes." 
                name="Sarah J." 
                title="University Student" 
              />
              <TestimonialCard 
                quote="QuizCraft caught nuances in my History lectures that I completely missed. It’s like having a TA in my pocket." 
                name="Michael B." 
                title="Grad Student" 
              />
              <TestimonialCard 
                quote="Works perfectly for technical Engineering PDFs. It handles formulas and diagrams better than any other tool." 
                name="David L." 
                title="Engineering Major" 
              />
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24 bg-muted/20 backdrop-blur-sm">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            </div>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-lg">Is QuizCraft free to use?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground">Yes! Free forever for up to 3 documents a month.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger className="text-lg">Can I trust the AI answers?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground">We always cite the page number from your document so you can verify facts instantly.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                 <AccordionTrigger className="text-lg flex gap-2 items-center"><Smartphone className="w-5 h-5 text-primary" /> Does it work on mobile?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground">Absolutely. QuizCraft is fully responsive.</AccordionContent>
              </AccordionItem>
               <AccordionItem value="item-4">
                 <AccordionTrigger className="text-lg flex gap-2 items-center"><Globe className="w-5 h-5 text-primary" /> What languages do you support?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground">Our AI understands over 50 languages. Upload in one, ask in another!</AccordionContent>
              </AccordionItem>
               <AccordionItem value="item-5">
                 <AccordionTrigger className="text-lg flex gap-2 items-center"><Download className="w-5 h-5 text-primary" /> Can I export my quizzes?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground">Yes. Export as PDF or text file anytime.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-background" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent z-0" />
          
          <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
            <h2 className="text-4xl md:text-6xl font-bold mb-8 tracking-tight">
              Ready to <span className={AURORA_TEXT_CLASS}>upgrade your grades</span>?
            </h2>
            <div className="flex flex-col items-center justify-center gap-4">
              <Button size="lg" className="h-14 px-10 rounded-full text-xl shadow-2xl hover:scale-105 transition-transform" asChild>
                <Link href="/signup">Get Started Now <ArrowRight className="ml-2 h-6 w-6" /></Link>
              </Button>
              <p className="text-sm font-medium text-muted-foreground mt-2">No credit card required.</p>
            </div>
            
            <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Free Plan Available
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Cancel Anytime
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}