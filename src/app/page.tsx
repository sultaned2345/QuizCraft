// src/app/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BookOpen, 
  Clock, 
  Target, 
  Brain, 
  Users, 
  Award, 
  Sparkles, 
  CheckCircle2, 
  Star, 
  Zap, 
  ArrowRight, 
  Leaf, 
  BarChart3, 
  ChevronDown, 
  Heart, 
  Shield, 
  Pause, 
  Timer, 
  Flame, 
  TrendingUp, 
  Lightbulb, 
  GraduationCap, 
  Coffee, 
  Headphones, 
  Trophy,
  FileText,
  PenTool
} from "lucide-react";

// --- CUSTOM COMPONENTS ---
import { Button } from "@/components/ui/button";
import { LandingHeader } from "@/components/LandingHeader";
import { Footer } from "@/components/Footer";
import { AuroraBackground } from "@/components/landing/AuroraBackground";
import { BentoGrid } from "@/components/landing/BentoGrid";
import { FoxMascot } from "@/components/FoxMascot";
import { AnimatedCounter } from "@/components/landing/animated-counter";
import { FeatureTab } from "@/components/landing/feature-tab"; // Ensure this file exists as per your upload
import CookieConsent from "@/components/CookieConsent";

// --- TYPES & DATA ---

const FAQS = [
  {
    q: "Is QuizCraft free to use?",
    a: "Yes! QuizCraft offers a generous free tier with core features like basic quiz generation and flashcards. Premium plans unlock AI essay grading, unlimited file uploads, and advanced analytics.",
  },
  {
    q: "How does the AI generation work?",
    a: "We use Gemini 1.5 Pro to analyze your uploaded documents (PDFs, PPTs) or text. It identifies key concepts, definitions, and relationships to generate exam-style questions and spaced-repetition flashcards.",
  },
  {
    q: "Can I upload handwritten notes?",
    a: "Currently, we support digital text (PDF, Word, PowerPoint). OCR for handwritten notes is in our roadmap for the next major update!",
  },
  {
    q: "Is there a student discount?",
    a: "Absolutely! Students with a valid .edu email address automatically receive 50% off all premium subscriptions.",
  },
];

export default function LandingPage() {
  // --- STATE FOR INTERACTIVE FEATURES ---
  const [activeFeature, setActiveFeature] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Auto-rotate the feature tabs
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 4);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  // --- FEATURE TABS CONTENT ---
  const features = [
    {
      icon: Brain,
      label: "AI Quizzes",
      title: "Instant Exam Generation",
      description: "Upload any PDF and get a test-ready quiz in seconds. Multiple choice, true/false, and short answer.",
      preview: (
        <div className="flex flex-col h-full bg-card rounded-xl overflow-hidden border border-border/50 relative">
          <div className="bg-muted/50 p-4 border-b flex justify-between items-center">
            <span className="text-xs font-mono text-muted-foreground">generating_quiz.exe</span>
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
          </div>
          <div className="p-6 space-y-4">
             <div className="flex gap-3 items-start animate-fade-in">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                   <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="space-y-2 w-full">
                   <div className="h-4 bg-muted rounded w-3/4" />
                   <div className="h-4 bg-muted rounded w-1/2" />
                </div>
             </div>
             <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 ml-11">
                <p className="text-sm font-medium text-primary mb-2">Question 1: What is the powerhouse of the cell?</p>
                <div className="space-y-2">
                   {['Nucleus', 'Mitochondria', 'Ribosome'].map((opt, i) => (
                      <div key={i} className={`p-2 rounded border text-xs ${i === 1 ? 'bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400' : 'bg-background border-border'}`}>
                         {opt}
                         {i === 1 && <CheckCircle2 className="w-3 h-3 inline ml-2" />}
                      </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      ),
    },
    {
      icon: Clock,
      label: "Focus Timer",
      title: "Deep Work Sessions",
      description: "Pomodoro-style timers that adapt to your natural rhythm. Take breaks when you need them.",
      preview: (
        <div className="flex flex-col items-center justify-center h-full py-8 bg-gradient-to-br from-card to-muted/20">
          <span className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Current Session</span>
          <div className="font-variant-numeric text-7xl font-bold text-foreground mb-2 tabular-nums tracking-tight">24:38</div>
          <div className="text-sm text-primary mb-6 font-medium bg-primary/10 px-3 py-1 rounded-full">Biology Chapter 12</div>
          <div className="flex gap-4">
            <button className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all hover:scale-105">
              <Pause className="h-6 w-6" />
            </button>
            <button className="h-14 w-14 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors">
              <Timer className="h-6 w-6 text-muted-foreground" />
            </button>
          </div>
        </div>
      ),
    },
    {
      icon: FileText,
      label: "Flashcards",
      title: "Smarter Memorization",
      description: "AI-powered spaced repetition that knows what you need to review and when.",
      preview: (
        <div className="relative h-full flex items-center justify-center py-8 perspective-1000">
          <div className="absolute w-64 h-44 rounded-2xl bg-muted border border-border/50 -rotate-6 -translate-x-4 translate-y-2 shadow-sm" />
          <div className="absolute w-64 h-44 rounded-2xl bg-muted/80 border border-border/50 rotate-3 translate-x-2 -translate-y-1 shadow-sm" />
          <motion.div 
            initial={{ rotateY: 0 }}
            animate={{ rotateY: [0, 180, 180, 0] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            className="relative w-72 h-48 rounded-2xl bg-card border border-primary/20 shadow-xl p-6 flex flex-col justify-between backface-hidden transform-style-3d"
          >
            <div className="text-xs text-muted-foreground flex justify-between">
               <span>Front</span>
               <Brain className="w-4 h-4 text-primary" />
            </div>
            <div className="text-xl font-medium text-center text-foreground mt-4">
               Quantum Entanglement
            </div>
            <div className="text-xs text-center text-muted-foreground mt-8">Tap to flip</div>
          </motion.div>
        </div>
      ),
    },
    {
      icon: BarChart3,
      label: "Analytics",
      title: "Track Your Growth",
      description: "Gentle insights that help you study smarter, not harder.",
      preview: (
        <div className="p-6 h-full bg-card/50">
          <div className="flex items-center justify-between mb-8">
            <span className="font-semibold text-lg">Performance</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Last 7 days</span>
          </div>
          <div className="flex items-end justify-between h-32 mb-6 gap-2">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => {
              const heights = [45, 70, 55, 85, 65, 40, 75];
              return (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <motion.div
                    initial={{ height: 0 }}
                    whileInView={{ height: `${heights[i]}%` }}
                    className={`w-full max-w-[24px] rounded-t-lg transition-colors ${i === 3 ? "bg-primary" : "bg-primary/20"}`}
                  />
                  <span className="text-[10px] text-muted-foreground font-medium">{day}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 text-sm border-t pt-4">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="font-medium">21 day streak</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="font-medium">+15% vs last week</span>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background overflow-x-hidden font-sans selection:bg-primary/20">
      
      {/* 1. STICKY HEADER */}
      <LandingHeader />

      <main className="flex-1">
        
        {/* ================= HERO SECTION (With Aurora & Fox) ================= */}
        <section className="relative w-full pt-16 pb-24 md:pt-32 md:pb-48 overflow-visible">
          {/* Background Gradient */}
          <AuroraBackground /> 

          {/* Floating Decorative Elements (From StudySpace) */}
          <div className="absolute top-32 right-[10%] hidden lg:block animate-float-delayed z-0 opacity-60">
             <div className="p-4 rounded-2xl bg-card/40 backdrop-blur-md border border-white/10 shadow-xl rotate-6">
                <Brain className="w-8 h-8 text-pink-400" />
             </div>
          </div>
          <div className="absolute bottom-40 left-[5%] hidden lg:block animate-float z-0 opacity-60">
             <div className="p-4 rounded-2xl bg-card/40 backdrop-blur-md border border-white/10 shadow-xl -rotate-12">
                <Trophy className="w-8 h-8 text-yellow-400" />
             </div>
          </div>

          <div className="relative z-10 container mx-auto px-4 md:px-6">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
              
              {/* Left Column: Copy & CTA */}
              <div className="flex-1 text-center lg:text-left space-y-8 animate-fade-in-up max-w-2xl">
                
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/30 border border-secondary/20 text-secondary-foreground text-sm font-medium backdrop-blur-md">
                  <Leaf className="w-4 h-4" />
                  <span>The calm, focused way to study</span>
                </div>

                {/* Headline */}
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] text-balance">
                  Your mind deserves a <br/>
                  <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-blue-500">
                    peaceful place
                    <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary/20" viewBox="0 0 100 10" preserveAspectRatio="none">
                       <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                    </svg>
                  </span> 
                  to grow.
                </h1>

                {/* Subheadline */}
                <p className="text-xl text-muted-foreground leading-relaxed">
                  QuizCraft adapts to how you learn. Turn chaotic notes into clear quizzes, flashcards, and summaries in seconds.
                </p>

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-4">
                  <Button size="lg" className="h-14 px-8 text-lg rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all hover:-translate-y-1" asChild>
                    <Link href="/signup">
                      Start for Free
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-2xl bg-background/50 backdrop-blur-sm border-2 hover:bg-background/80" asChild>
                    <Link href="#features">See How It Works</Link>
                  </Button>
                </div>

                {/* Social Proof Stats */}
                <div className="pt-8 flex items-center justify-center lg:justify-start gap-8 text-sm text-muted-foreground">
                  <div className="flex items-center gap-3">
                     <div className="flex -space-x-3">
                        {[1,2,3,4].map(i => (
                           <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center overflow-hidden">
                              <img src={`/placeholder-user.jpg`} className="w-full h-full object-cover opacity-80" alt="" />
                           </div>
                        ))}
                     </div>
                     <p><span className="font-bold text-foreground">50k+</span> students</p>
                  </div>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-1.5">
                     <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                     <p><span className="font-bold text-foreground">4.9</span> app store</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Fox Mascot & Floating Cards */}
              <div className="flex-1 relative w-full max-w-lg aspect-square lg:h-auto flex items-center justify-center">
                
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-primary/20 blur-[120px] rounded-full animate-pulse-slow" />
                
                {/* The Mascot Component */}
                <div className="relative z-10 w-full h-full transform hover:scale-105 transition-transform duration-700">
                    <FoxMascot />
                </div>

                {/* Floating "Success" Cards (StudySpace Style) */}
                <motion.div 
                  initial={{ y: 0 }}
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-10 right-0 lg:-right-4 bg-card/80 backdrop-blur-md border border-white/20 p-4 rounded-2xl shadow-xl hidden sm:block z-20"
                >
                   <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-green-500/10 rounded-xl">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Exam Status</p>
                        <p className="font-bold text-foreground">Passed! 🎉</p>
                      </div>
                   </div>
                </motion.div>

                <motion.div 
                  initial={{ y: 0 }}
                  animate={{ y: [0, 15, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  className="absolute bottom-10 left-0 lg:-left-8 bg-card/80 backdrop-blur-md border border-white/20 p-4 rounded-2xl shadow-xl hidden sm:block z-20"
                >
                   <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-orange-500/10 rounded-xl">
                        <Flame className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Streak</p>
                        <p className="font-bold text-foreground">21 Days 🔥</p>
                      </div>
                   </div>
                </motion.div>

              </div>
            </div>
          </div>
        </section>

        {/* ================= STATS SECTION ================= */}
        <section className="py-16 bg-muted/30 border-y border-border/50">
           <div className="container mx-auto px-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                 {[
                   { icon: Users, val: 50000, suffix: "+", label: "Active Students" },
                   { icon: Brain, val: 12, suffix: "M", label: "Questions Answered" },
                   { icon: Star, val: 4.9, suffix: "", label: "Average Rating" },
                   { icon: GraduationCap, val: 98, suffix: "%", label: "Pass Rate" },
                 ].map((stat, i) => (
                   <div key={i} className="flex flex-col items-center group">
                      <div className="mb-4 p-3 rounded-2xl bg-background border border-border shadow-sm group-hover:scale-110 transition-transform">
                         <stat.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="text-3xl md:text-4xl font-bold mb-1 tabular-nums">
                         <AnimatedCounter target={stat.val} suffix={stat.suffix} />
                      </div>
                      <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
                   </div>
                 ))}
              </div>
           </div>
        </section>

        {/* ================= INTERACTIVE FEATURES TAB (The "800 Lines" Complex Logic) ================= */}
        <section id="features" className="container mx-auto px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary font-medium mb-6">
              <Zap className="h-4 w-4" />
              <span>Powerful Features</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 text-balance">
              Tools that feel like <span className="text-primary">magic</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Every feature is designed to reduce anxiety and maximize retention.
            </p>
          </div>

          <div className="mx-auto max-w-6xl">
            {/* Tabs Navigation */}
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              {features.map((feature, i) => (
                <FeatureTab
                  key={i}
                  active={activeFeature === i}
                  onClick={() => {
                    setActiveFeature(i);
                    setIsPlaying(false); // Pause auto-rotation on interaction
                  }}
                  icon={feature.icon}
                  label={feature.label}
                />
              ))}
            </div>

            {/* Feature Content Display */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1 animate-fade-in space-y-8">
                <div>
                   <h3 className="text-3xl font-bold mb-4 flex items-center gap-3">
                     {features[activeFeature].title}
                   </h3>
                   <p className="text-lg text-muted-foreground leading-relaxed">
                     {features[activeFeature].description}
                   </p>
                </div>
                
                <ul className="space-y-4">
                  {["Syncs across devices", "Export to PDF", "AI-powered insights"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="p-1 rounded-full bg-green-500/10">
                         <CheckCircle2 className="h-5 w-5 text-green-600" />
                      </div>
                      <span className="font-medium">{item}</span>
                    </li>
                  ))}
                </ul>

                <Button size="lg" className="rounded-full px-8" asChild>
                   <Link href="/signup">Try {features[activeFeature].label}</Link>
                </Button>
              </div>

              {/* Feature Preview Window */}
              <div className="order-1 md:order-2 h-[400px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeFeature}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="h-full w-full rounded-3xl bg-muted/20 border border-border/50 shadow-2xl overflow-hidden"
                  >
                    {features[activeFeature].preview}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        {/* ================= BENTO GRID (The Extra "Things We Did") ================= */}
        {/* We include this below the tabs for the "Maximalist" feel */}
        <div className="py-12 bg-muted/20">
           <div className="container mx-auto px-4">
               <h3 className="text-2xl font-bold text-center mb-8">More ways to learn</h3>
               <BentoGrid />
           </div>
        </div>


        {/* ================= TESTIMONIALS ================= */}
        <section id="testimonials" className="py-24 bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold tracking-tight mb-4">
                  Real results from real students
                </h2>
                <p className="text-muted-foreground text-lg">See how QuizCraft transformed their academic journey.</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {[
                  {
                    name: "Alex Thompson",
                    school: "Yale University",
                    before: "C+ Average",
                    after: "A- Average",
                    quote: "I went from struggling to thriving. The AI summaries are a lifesaver.",
                    metric: "+1.2 GPA",
                    image: "A",
                  },
                  {
                    name: "Priya Sharma",
                    school: "Stanford",
                    before: "2 hrs/day",
                    after: "4.5 hrs/day",
                    quote: "Finally found my study flow. The focus timer actually works.",
                    metric: "2.5x focus",
                    image: "P",
                  },
                  {
                    name: "Marcus Lee",
                    school: "MIT",
                    before: "50% retention",
                    after: "89% retention",
                    quote: "The flashcards changed everything for my engineering exams.",
                    metric: "+78% memory",
                    image: "M",
                  },
                ].map((story, i) => (
                  <div
                    key={i}
                    className="group rounded-3xl bg-card border border-border/50 p-6 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center text-lg font-bold text-primary">
                        {story.image}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{story.name}</p>
                        <p className="text-xs text-muted-foreground">{story.school}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mb-6 text-sm">
                      <div className="flex-1 text-center p-3 rounded-xl bg-muted/50">
                        <p className="text-[10px] uppercase text-muted-foreground mb-1 font-bold">Before</p>
                        <p className="text-foreground">{story.before}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                      <div className="flex-1 text-center p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                        <p className="text-[10px] uppercase text-green-600 mb-1 font-bold">After</p>
                        <p className="text-foreground font-medium">{story.after}</p>
                      </div>
                    </div>

                    <p className="text-muted-foreground mb-6 leading-relaxed italic">"{story.quote}"</p>

                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 text-xs text-primary font-bold border border-primary/10">
                      <TrendingUp className="h-3 w-3" />
                      {story.metric}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================= PRICING ================= */}
        <section id="pricing" className="container mx-auto px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary mb-6">
                <Zap className="h-4 w-4" />
                <span>Simple Pricing</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
                Start free, upgrade when ready
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                No hidden fees. No surprises. Just honest pricing for students.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  name: "Free",
                  price: "$0",
                  period: "forever",
                  desc: "Perfect for getting started",
                  features: ["3 Quizzes / day", "Up to 100 flashcards", "7-day analytics", "1 device"],
                  cta: "Get Started",
                  popular: false,
                },
                {
                  name: "Pro",
                  price: "$9",
                  period: "/month",
                  desc: "For serious students",
                  features: [
                    "Unlimited flashcards",
                    "AI Essay Grader",
                    "Advanced analytics",
                    "Unlimited devices",
                    "Priority support",
                  ],
                  cta: "Start Free Trial",
                  popular: true,
                },
                {
                  name: "Team",
                  price: "$29",
                  period: "/month",
                  desc: "For study groups",
                  features: [
                    "Everything in Pro",
                    "5 team members",
                    "Shared flashcard decks",
                    "Group analytics",
                    "Admin dashboard",
                  ],
                  cta: "Contact Sales",
                  popular: false,
                },
              ].map((plan, i) => (
                <div
                  key={i}
                  className={`relative rounded-[2rem] p-8 flex flex-col transition-all duration-300 hover:-translate-y-2 ${
                    plan.popular 
                      ? "bg-primary text-primary-foreground shadow-2xl shadow-primary/20 ring-4 ring-primary/20" 
                      : "bg-card border border-border/60 shadow-lg"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-background text-foreground text-xs font-bold uppercase tracking-wider shadow-sm border">
                      Most Popular
                    </div>
                  )}
                  
                  <div className="mb-8">
                    <h3 className={`font-bold text-xl mb-2 ${plan.popular ? "text-primary-foreground" : "text-foreground"}`}>
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-4xl font-extrabold ${plan.popular ? "text-primary-foreground" : "text-foreground"}`}>
                        {plan.price}
                      </span>
                      <span className={`text-sm ${plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {plan.period}
                      </span>
                    </div>
                    <p className={`text-sm mt-3 ${plan.popular ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                      {plan.desc}
                    </p>
                  </div>

                  <ul className="space-y-4 mb-8 flex-1">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-3 text-sm">
                        <div className={`p-0.5 rounded-full ${plan.popular ? "bg-white/20" : "bg-primary/10"}`}>
                           <CheckCircle2 className={`h-4 w-4 ${plan.popular ? "text-white" : "text-primary"}`} />
                        </div>
                        <span className={plan.popular ? "text-primary-foreground" : "text-foreground"}>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    size="lg"
                    className={`w-full rounded-xl h-12 font-bold ${
                      plan.popular 
                        ? "bg-background text-foreground hover:bg-background/90" 
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
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
        <section className="py-24 bg-muted/20">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight mb-4">Frequently asked questions</h2>
              <p className="text-muted-foreground">Everything you need to know about QuizCraft</p>
            </div>

            <div className="space-y-4">
              {FAQS.map((faq, i) => (
                <div key={i} className="rounded-2xl bg-card border border-border/50 overflow-hidden shadow-sm">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/30 transition-colors"
                  >
                    <span className="font-semibold text-lg">{faq.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`}
                    />
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-6 pb-6 text-muted-foreground leading-relaxed"
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
        <section className="container mx-auto px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="relative rounded-[2.5rem] bg-gradient-to-br from-primary/10 via-card to-blue-500/5 border border-border/60 p-12 sm:p-20 text-center overflow-hidden shadow-2xl">
              {/* Background Blobs */}
              <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] animate-pulse-soft" />
              <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] animate-pulse-soft" style={{ animationDelay: "1.5s" }} />

              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 rounded-full bg-background/80 backdrop-blur border border-border px-4 py-2 text-sm font-medium mb-8">
                  <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                  <span>Join 50,000+ happy students</span>
                </div>

                <h2 className="text-4xl sm:text-6xl font-bold tracking-tight mb-8 text-balance">
                  Ready to transform <br/> how you study?
                </h2>
                <p className="text-muted-foreground text-xl max-w-2xl mx-auto mb-10">
                  Start your free account today. No credit card required. Cancel anytime.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    className="rounded-full h-16 px-10 text-xl shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-1 transition-all duration-300"
                    asChild
                  >
                    <Link href="/signup">
                      Start for Free
                      <ArrowRight className="ml-2 h-6 w-6" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-full h-16 px-10 text-xl border-2 hover:bg-muted/50 bg-transparent"
                    asChild
                  >
                    <Link href="#demo">View Demo</Link>
                  </Button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-8 mt-12 text-sm text-muted-foreground font-medium">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span>GDPR Compliant</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span>Setup in 2 minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                     <span>Systems Operational</span>
                  </div>
                </div>
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