'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LandingHeader } from "@/components/LandingHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, Sparkles, User, CheckCircle2, Download, Smartphone, Image as ImageIcon } from "lucide-react";

// --- New Interactive Components ---
import { BentoGrid } from "@/components/landing/BentoGrid";
import { BrainToQuizSection } from "@/components/landing/BrainToQuizSection";
import { SpotlightCursor } from "@/components/landing/SpotlightCursor";
import { Typewriter } from "@/components/landing/Typewriter";

// --- Aurora Background (Increased Intensity) ---
function AuroraBackground() {
  return (
    <div className="absolute inset-0 -z-20 overflow-hidden pointer-events-none bg-zinc-950">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/30 blur-[120px] animate-aurora-1 opacity-80" />
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-blue-500/20 blur-[100px] animate-aurora-2 opacity-70" />
      <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[50%] rounded-full bg-purple-500/25 blur-[120px] animate-aurora-3 opacity-70" />
    </div>
  );
}

function TestimonialCard({ quote, name, title }: { quote: string; name: string; title: string }) {
  return (
    <Card className="h-full flex flex-col bg-card/40 backdrop-blur-sm border-white/10 shadow-lg hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
      <CardContent className="pt-6 flex-1">
        <blockquote className="text-lg leading-relaxed text-foreground/90">"{quote}"</blockquote>
      </CardContent>
      <CardFooter>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
            <User className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold">{name}</p>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const handleSmartStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      router.push(`/signup?email=${encodeURIComponent(email)}`);
    } else {
      router.push('/signup');
    }
  };

  return (
    // Forces Dark Mode for the Landing Page to make Aurora pop
    <div className="dark flex flex-col min-h-screen font-sans relative selection:bg-primary/20 bg-zinc-950 text-foreground">
      <SpotlightCursor />
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
              Turn Notes into <br />
              {/* Typewriter Effect */}
              <Typewriter />
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
              Stop highlighting endless PDFs. Transform your raw study materials into 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-blue-600 font-bold px-1"> interactive quizzes </span> 
              and flashcards instantly.
            </p>

            {/* Smart Email Input */}
            <form onSubmit={handleSmartStart} className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
              <Input 
                type="email" 
                placeholder="Enter your email..." 
                className="h-14 rounded-full px-6 text-lg bg-background/50 backdrop-blur-sm border-primary/20 shadow-lg focus-visible:ring-primary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button size="lg" type="submit" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-105 w-full sm:w-auto">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </form>
          </div>
        </section>

        {/* Interactive Brain Animation */}
        <BrainToQuizSection />

        {/* Deep-Linked Bento Grid */}
        <BentoGrid />

        {/* Testimonials */}
        <section className="py-24 bg-transparent">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Don't just study. Understand.</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">See what other learners are saying about QuizCraft.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <TestimonialCard quote="I used to spend 5 hours making flashcards for Biology. Yesterday I did it in 3 minutes." name="Sarah J." title="University Student" />
              <TestimonialCard quote="QuizCraft caught nuances in my History lectures that I completely missed. It’s like having a TA in my pocket." name="Michael B." title="Grad Student" />
              <TestimonialCard quote="Works perfectly for technical Engineering PDFs. It handles formulas and diagrams better than any other tool." name="David L." title="Engineering Major" />
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24 bg-muted/10 backdrop-blur-sm border-t border-white/5">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            </div>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-lg">Is QuizCraft free to use?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground">Yes! Free forever for up to 3 documents a month. No credit card required.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger className="text-lg">Can I trust the AI answers?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground">We always cite the page number from your document so you can verify facts instantly.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                 <AccordionTrigger className="text-lg flex gap-2 items-center"><Smartphone className="w-5 h-5 text-primary" /> Does it work on mobile?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground">Absolutely. QuizCraft is fully responsive.</AccordionContent>
              </AccordionItem>
               <AccordionItem value="item-5">
                 <AccordionTrigger className="text-lg flex gap-2 items-center"><Download className="w-5 h-5 text-primary" /> Can I export my quizzes?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground">Yes. Export as PDF, Text file, or CSV anytime.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-6">
                 <AccordionTrigger className="text-lg flex gap-2 items-center"><ImageIcon className="w-5 h-5 text-primary" /> Can I upload handwritten notes?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground">Yes! Our OCR technology can read clear handwriting and convert it into digital quizzes.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-background" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent z-0" />
          
          <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
            <h2 className="text-4xl md:text-6xl font-bold mb-8 tracking-tight">Ready to upgrade your grades?</h2>
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