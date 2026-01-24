// src/app/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, 
  BookOpen, 
  Brain, 
  Sparkles, 
  Trophy, 
  Users, 
  CheckCircle2, 
  Zap,
  Star,
  Clock,
  Shield,
  GraduationCap,
  ChevronDown,
  Flame,
  MousePointer2,
  PlayCircle
} from "lucide-react";

// --- CUSTOM COMPONENTS ---
import { Button } from "@/components/ui/button";
import { AuroraBackground } from "@/components/landing/AuroraBackground";
import { BentoGrid } from "@/components/landing/BentoGrid";
import { AnimatedCounter } from "@/components/landing/animated-counter";
import { TestimonialCard } from "@/components/landing/TestimonialCard";
import { Footer } from "@/components/Footer";
import { LandingHeader } from "@/components/LandingHeader";
import { FoxMascot } from "@/components/FoxMascot"; // Assuming this was created as discussed
import CookieConsent from "@/components/CookieConsent";

// --- TYPES & DATA ---

const FAQS = [
  {
    q: "Is QuizCraft free to use?",
    a: "Yes! We offer a generous free tier that lets you generate up to 3 quizzes per day. Premium plans unlock unlimited generation, AI essay grading, and advanced analytics.",
  },
  {
    q: "How accurate is the AI?",
    a: "We use the latest Gemini 1.5 Pro and GPT-4o models, which have a 98% accuracy rate on academic content. However, we always recommend reviewing the generated questions.",
  },
  {
    q: "Can I upload handwritten notes?",
    a: "Currently, we support PDF text, Word docs, and PowerPoint. Handwritten OCR is coming in our next update!",
  },
  {
    q: "Do you offer student discounts?",
    a: "Yes! Use your .edu email address when signing up to automatically receive 50% off any premium plan.",
  },
];

const PRICING_PLANS = [
  {
    name: "Starter",
    price: "Free",
    desc: "Perfect for casual studying",
    features: ["3 Quizzes / Day", "Upload PDFs up to 10MB", "Basic Flashcards", "7-Day History"],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Pro Scholar",
    price: "$9.99",
    period: "/mo",
    desc: "For serious students aiming for A's",
    features: ["Unlimited Quizzes", "AI Essay Grader", "Uploads up to 100MB", "YouTube to Quiz", "Priority Support"],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Team",
    price: "$29.99",
    period: "/mo",
    desc: "For study groups & classrooms",
    features: ["Everything in Pro", "Up to 5 Users", "Shared Decks", "Group Analytics", "Admin Dashboard"],
    cta: "Create Team",
    popular: false,
  },
];

// --- MAIN PAGE COMPONENT ---

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

  // Floating animation variants
  const floatingVariant = {
    initial: { y: 0 },
    animate: { 
      y: [0, -10, 0], 
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" } 
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/20">
      
      {/* 1. STICKY HEADER */}
      <LandingHeader />

      <main className="flex-1">
        
        {/* ================= HERO SECTION ================= */}
        <section className="relative w-full min-h-[95vh] flex flex-col justify-center overflow-hidden pt-16">
          <AuroraBackground /> 

          <div className="container relative z-10 mx-auto px-4 md:px-6 h-full flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            
            {/* Left Column: Copy */}
            <motion.div 
              style={{ opacity, scale }}
              className="flex-1 text-center lg:text-left space-y-8 max-w-2xl"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium backdrop-blur-md animate-fade-in">
                <Sparkles className="w-4 h-4" />
                <span>Powered by Gemini 1.5 Pro</span>
              </div>

              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] drop-shadow-sm">
                Study Smarter, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-blue-500 animate-gradient-x">
                  Not Harder.
                </span>
              </h1>

              <p className="text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
                Turn your chaotic notes into interactive 
                <span className="font-semibold text-foreground"> quizzes</span>, 
                <span className="font-semibold text-foreground"> flashcards</span>, and 
                <span className="font-semibold text-foreground"> summaries</span> instantly.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-lg hover:shadow-primary/25 transition-all hover:scale-105 group" asChild>
                  <Link href="/signup">
                    Start Learning Free
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full backdrop-blur-sm bg-background/30 hover:bg-background/50 border-primary/20" asChild>
                  <Link href="#demo">
                    <PlayCircle className="mr-2 w-5 h-5" />
                    Watch Demo
                  </Link>
                </Button>
              </div>

              {/* Social Proof Pills */}
              <div className="pt-8 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card/40 border border-border/50 backdrop-blur-sm">
                   <div className="flex -space-x-3">
                     {[1,2,3].map(i => (
                       <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-gradient-to-br from-gray-200 to-gray-400" />
                     ))}
                   </div>
                   <div className="flex flex-col text-left leading-tight">
                     <span className="font-bold text-foreground"><AnimatedCounter target={50000} suffix="+" /></span>
                     <span className="text-[10px]">Students</span>
                   </div>
                </div>
                
                <div className="h-8 w-px bg-border/50 hidden sm:block" />
                
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-foreground">4.9/5</span>
                  <span>rating on App Store</span>
                </div>
              </div>
            </motion.div>

            {/* Right Column: Fox Mascot & Floating Cards */}
            <div className="flex-1 relative w-full max-w-lg lg:max-w-xl aspect-square flex items-center justify-center">
              
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-primary/20 blur-[120px] rounded-full animate-pulse-slow" />
              
              {/* FOX MASCOT */}
              <div className="relative z-20 w-full h-full transform hover:scale-105 transition-transform duration-700">
                 <FoxMascot />
              </div>

              {/* Floating UI Card 1: Success */}
              <motion.div 
                variants={floatingVariant}
                initial="initial"
                animate="animate"
                className="absolute top-10 -right-4 lg:-right-12 bg-card/90 backdrop-blur-md border border-border p-4 rounded-2xl shadow-2xl z-30 w-48 hidden sm:block"
              >
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 rounded-full">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Status</p>
                      <p className="font-bold text-sm text-foreground">Exam Passed! 🎉</p>
                    </div>
                 </div>
              </motion.div>

              {/* Floating UI Card 2: Streak */}
              <motion.div 
                 animate={{ y: [0, 15, 0] }}
                 transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                 className="absolute bottom-20 -left-4 lg:-left-12 bg-card/90 backdrop-blur-md border border-border p-4 rounded-2xl shadow-2xl z-30 w-48 hidden sm:block"
              >
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-full">
                      <Flame className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Streak</p>
                      <p className="font-bold text-sm text-foreground">21 Days 🔥</p>
                    </div>
                 </div>
                 <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 w-[80%]" />
                 </div>
              </motion.div>

            </div>
          </div>
          
          {/* Scroll Indicator */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: 2 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 text-muted-foreground flex flex-col items-center gap-2"
          >
            <span className="text-xs uppercase tracking-widest">Scroll to Explore</span>
            <MousePointer2 className="w-5 h-5" />
          </motion.div>
        </section>

        {/* ================= STATS BANNER ================= */}
        <section className="py-10 border-y bg-muted/30">
           <div className="container mx-auto px-4 flex flex-wrap justify-around gap-8 text-center">
              {[
                { label: "Quizzes Generated", val: 50000, suffix: "+" },
                { label: "Study Hours Saved", val: 12000, suffix: "h" },
                { label: "Universities", val: 150, suffix: "+" },
              ].map((stat, i) => (
                <div key={i} className="flex flex-col items-center">
                   <div className="text-3xl md:text-4xl font-bold font-serif text-foreground">
                      <AnimatedCounter target={stat.val} suffix={stat.suffix} />
                   </div>
                   <p className="text-sm text-muted-foreground uppercase tracking-wider mt-1">{stat.label}</p>
                </div>
              ))}
           </div>
        </section>

        {/* ================= BENTO GRID FEATURES ================= */}
        <section id="features" className="py-24 md:py-32 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] -z-10" />
          
          <div className="container mx-auto px-4">
             <div className="text-center mb-16 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-sm text-blue-600 font-medium">
                  <Zap className="h-4 w-4" />
                  <span>Supercharge your brain</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Everything you need to <span className="text-primary underline decoration-wavy decoration-2 underline-offset-4">excel</span></h2>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Forget static PDFs. QuizCraft transforms your study materials into an active learning engine.
                </p>
             </div>
             
             {/* The Complex Bento Grid Component */}
             <BentoGrid />
          </div>
        </section>

        {/* ================= HOW IT WORKS ================= */}
        <section className="py-24 bg-card border-y border-border/50">
          <div className="container mx-auto px-4">
             <div className="flex flex-col md:flex-row gap-16 items-center">
                <div className="flex-1 space-y-8">
                   <h2 className="text-3xl md:text-4xl font-bold">From Chaos to Clarity in <br /><span className="text-primary">3 Simple Steps</span></h2>
                   <p className="text-lg text-muted-foreground">Stop wasting hours highlighting text. Let our AI extract the signal from the noise.</p>
                   
                   <div className="space-y-6">
                      {[
                        { icon: BookOpen, title: "1. Upload Material", desc: "Drag & drop your lecture slides (PDF), textbooks, or even paste a YouTube URL." },
                        { icon: Brain, title: "2. AI Analysis", desc: "Our Gemini engine reads your content, understanding context, dates, and formulas." },
                        { icon: Trophy, title: "3. Master It", desc: "Start a personalized quiz or flip through generated flashcards immediately." }
                      ].map((step, idx) => (
                        <div key={idx} className="flex gap-4 p-4 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
                           <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                              <step.icon className="w-6 h-6" />
                           </div>
                           <div>
                              <h3 className="font-bold text-lg">{step.title}</h3>
                              <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                           </div>
                        </div>
                      ))}
                   </div>
                   
                   <Button size="lg" className="mt-4 rounded-full px-8">Try it Now</Button>
                </div>
                
                {/* Visual Representation */}
                <div className="flex-1 relative">
                   <div className="relative w-full aspect-[4/3] bg-muted rounded-2xl border border-border shadow-2xl overflow-hidden flex items-center justify-center">
                      <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
                      {/* Abstract UI Mockup */}
                      <div className="w-[80%] h-[80%] bg-background rounded-xl shadow-lg border border-border/40 p-6 space-y-4">
                          <div className="flex gap-2 mb-6">
                             <div className="w-3 h-3 rounded-full bg-red-400" />
                             <div className="w-3 h-3 rounded-full bg-yellow-400" />
                             <div className="w-3 h-3 rounded-full bg-green-400" />
                          </div>
                          <div className="h-4 bg-muted rounded w-3/4" />
                          <div className="h-4 bg-muted rounded w-1/2" />
                          <div className="h-32 bg-primary/5 rounded border border-dashed border-primary/20 flex items-center justify-center">
                              <span className="text-xs text-primary font-mono">Processing PDF...</span>
                          </div>
                      </div>
                      
                      {/* Floating Badge */}
                      <div className="absolute bottom-8 right-8 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg font-bold text-sm animate-bounce-slow">
                         Generated!
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </section>

        {/* ================= TESTIMONIALS ================= */}
        <section className="py-24 overflow-hidden">
           <div className="container mx-auto px-4 mb-12 text-center">
              <h2 className="text-3xl font-bold mb-4">Loved by Students</h2>
              <p className="text-muted-foreground">Join the community boosting their GPA.</p>
           </div>
           
           <div className="container mx-auto px-4">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    name: "Sarah J.",
                    role: "Medical Student",
                    quote: "I used to spend 4 hours just making flashcards. QuizCraft does it in 30 seconds. It saved my finals.",
                    rating: 5
                  },
                  {
                    name: "Michael Chen",
                    role: "Law Student",
                    quote: "The case summary feature is incredible. It extracts exactly the legal precedents I need to remember.",
                    rating: 5
                  },
                  {
                    name: "Emily R.",
                    role: "History Major",
                    quote: "Timeline generation from my textbooks? Yes please. This is exactly what I needed for my thesis.",
                    rating: 5
                  }
                ].map((t, i) => (
                  <TestimonialCard key={i} {...t} title={t.role} />
                ))}
              </div>
           </div>
        </section>

        {/* ================= PRICING ================= */}
        <section id="pricing" className="py-24 bg-muted/20">
           <div className="container mx-auto px-4">
              <div className="text-center max-w-2xl mx-auto mb-16">
                 <h2 className="text-3xl md:text-5xl font-bold mb-4">Fair Pricing for Everyone</h2>
                 <p className="text-muted-foreground text-lg">Invest in your grades for less than the cost of a coffee.</p>
              </div>

              <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                 {PRICING_PLANS.map((plan, idx) => (
                   <div 
                      key={idx} 
                      className={`relative flex flex-col p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-2
                        ${plan.popular 
                          ? "bg-background border-primary shadow-2xl shadow-primary/10 ring-1 ring-primary" 
                          : "bg-card/50 border-border/50 shadow-sm"
                        }
                      `}
                   >
                      {plan.popular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-purple-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                           Most Popular
                        </div>
                      )}

                      <div className="mb-8">
                         <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                         <p className="text-muted-foreground text-sm h-10">{plan.desc}</p>
                      </div>

                      <div className="mb-8 flex items-baseline gap-1">
                         <span className="text-4xl font-extrabold">{plan.price}</span>
                         <span className="text-muted-foreground">{plan.period}</span>
                      </div>

                      <ul className="flex-1 space-y-4 mb-8">
                         {plan.features.map((feat, fIdx) => (
                           <li key={fIdx} className="flex items-center gap-3 text-sm">
                              <CheckCircle2 className={`w-5 h-5 ${plan.popular ? "text-primary" : "text-muted-foreground"}`} />
                              <span>{feat}</span>
                           </li>
                         ))}
                      </ul>

                      <Button 
                        size="lg" 
                        variant={plan.popular ? "default" : "outline"} 
                        className={`w-full rounded-xl ${plan.popular ? "bg-primary shadow-lg" : ""}`}
                        asChild
                      >
                         <Link href="/signup">{plan.cta}</Link>
                      </Button>
                   </div>
                 ))}
              </div>
           </div>
        </section>

        {/* ================= FAQ ================= */}
        <section className="py-24">
           <div className="container mx-auto px-4 max-w-3xl">
              <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
              <div className="space-y-4">
                 {FAQS.map((faq, i) => (
                    <div key={i} className="border border-border rounded-xl bg-card overflow-hidden">
                       <button 
                          onClick={() => setOpenFaq(openFaq === i ? null : i)}
                          className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/50 transition-colors"
                       >
                          <span className="font-semibold text-lg">{faq.q}</span>
                          <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`} />
                       </button>
                       <AnimatePresence>
                         {openFaq === i && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="px-6 pb-6 text-muted-foreground leading-relaxed border-t border-border/50 pt-4"
                            >
                               {faq.a}
                            </motion.div>
                         )}
                       </AnimatePresence>
                    </div>
                 ))}
              </div>
           </div>
        </section>

        {/* ================= FINAL CTA ================= */}
        <section className="py-20 relative overflow-hidden">
           {/* Dynamic Background */}
           <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
           <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
           
           <div className="container mx-auto px-4 relative z-10 text-center">
              <div className="max-w-3xl mx-auto space-y-8">
                  <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-12">
                     <GraduationCap className="w-8 h-8 text-primary" />
                  </div>
                  
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Ready to ace your next exam?</h2>
                  <p className="text-xl text-muted-foreground">Join 50,000+ students studying smarter with QuizCraft today.</p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                     <Button size="lg" className="h-14 px-10 text-lg rounded-full shadow-2xl animate-pulse-slow bg-primary text-primary-foreground" asChild>
                        <Link href="/signup">Start Learning for Free</Link>
                     </Button>
                     <p className="text-xs text-muted-foreground mt-4 sm:mt-0 sm:absolute sm:-bottom-8">
                        No credit card required • Cancel anytime
                     </p>
                  </div>
              </div>
           </div>
        </section>

      </main>

      <Footer />
      <CookieConsent />
    </div>
  );
}