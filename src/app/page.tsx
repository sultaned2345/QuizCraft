"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/landing/animated-counter";
import { FeatureTab } from "@/components/landing/feature-tab";
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
  MessageCircle,
  Layers,
  Mic,
} from "lucide-react";

// --- FIX: Extract Auth Logic to Component ---
function AuthRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  useEffect(() => {
    if (code) {
      router.push(`/auth/callback?code=${code}`);
    }
  }, [code, router]);

  return null; // This component renders nothing, just handles logic
}
// --------------------------------------------

export default function LandingPage() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 6);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const features = [
    {
      icon: Sparkles,
      label: "AI Quizzes",
      title: "Generate quizzes instantly",
      description: "Upload any PDF, text, or YouTube video, and our AI will craft perfect multiple-choice questions to test your knowledge.",
      preview: (
        <div className="flex flex-col h-full p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-md bg-primary/10 text-xs font-medium text-primary">Generated from PDF</span>
            </div>
            <span className="text-xs text-muted-foreground">Question 1/10</span>
          </div>
          <div className="space-y-6">
            <h4 className="font-serif text-xl sm:text-2xl text-foreground">What is the primary function of the mitochondria?</h4>
            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-border/60 bg-card hover:bg-muted/50 transition-colors cursor-pointer flex items-center gap-3">
                <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                <span className="text-sm text-foreground">Protein synthesis</span>
              </div>
              <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5 cursor-pointer flex items-center gap-3">
                <div className="h-5 w-5 rounded-full border-[5px] border-primary" />
                <span className="text-sm font-medium text-foreground">Energy production (ATP)</span>
              </div>
              <div className="p-4 rounded-xl border border-border/60 bg-card hover:bg-muted/50 transition-colors cursor-pointer flex items-center gap-3">
                <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                <span className="text-sm text-foreground">Cell division</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: FileText,
      label: "Smart Notes",
      title: "Beautiful, organized notes",
      description: "Create rich text notes or let AI summarize your study materials. Automatic linking connects related concepts across your workspace.",
      preview: (
        <div className="relative h-full p-6 overflow-hidden">
          <div className="absolute top-0 right-0 p-4 bg-background/80 backdrop-blur-sm z-10 border-b border-l border-border/40 rounded-bl-2xl">
            <div className="flex gap-2">
               <div className="h-2 w-2 rounded-full bg-red-400" />
               <div className="h-2 w-2 rounded-full bg-yellow-400" />
               <div className="h-2 w-2 rounded-full bg-green-400" />
            </div>
          </div>
          <div className="space-y-4 max-w-[90%]">
            <div className="h-8 w-3/4 bg-foreground/10 rounded-lg animate-pulse" />
            <div className="space-y-2 pt-4">
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
              <div className="h-4 w-4/6 bg-muted rounded animate-pulse" />
            </div>
            <div className="p-4 rounded-lg bg-secondary/10 border border-secondary/20 mt-4">
              <div className="flex items-center gap-2 mb-2 text-secondary-foreground">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">AI Summary</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The content discusses the three laws of thermodynamics. Key points include entropy, energy conservation, and absolute zero...
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Layers,
      label: "Flashcards",
      title: "Master with spaced repetition",
      description: "Forget forgetting. Our smart algorithm schedules reviews exactly when you need them to maximize retention efficiency.",
      preview: (
        <div className="relative h-full flex items-center justify-center py-8">
          <div className="absolute w-64 h-40 rounded-2xl bg-muted -rotate-6 -translate-x-4 translate-y-2 opacity-50" />
          <div className="absolute w-64 h-40 rounded-2xl bg-muted/70 rotate-3 translate-x-2 -translate-y-1 opacity-80" />
          <div className="relative w-72 h-48 rounded-2xl bg-card border border-border/60 shadow-xl p-6 flex flex-col justify-between transform transition-transform hover:scale-[1.02]">
            <div className="flex justify-between items-start">
               <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Physics • Card 42</div>
               <Brain className="h-4 w-4 text-secondary/50" />
            </div>
            <div className="font-serif text-2xl text-foreground text-center my-4">What is Newton&apos;s Second Law?</div>
            <div className="space-y-3">
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full w-2/3 bg-secondary" />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Hard</span>
                <span>Good</span>
                <span>Easy</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: MessageCircle,
      label: "AI Tutor",
      title: "Your personal study guide",
      description: "Stuck on a concept? Chat with your documents. Ask questions, request examples, and get instant clarifications.",
      preview: (
        <div className="flex flex-col h-full">
          <div className="flex-1 p-6 space-y-4 overflow-hidden relative">
            <div className="flex justify-end">
              <div className="bg-primary text-primary-foreground px-4 py-3 rounded-2xl rounded-tr-sm text-sm max-w-[85%]">
                Can you explain quantum entanglement simply?
              </div>
            </div>
            <div className="flex justify-start">
              <div className="bg-muted text-foreground px-4 py-3 rounded-2xl rounded-tl-sm text-sm max-w-[85%] border border-border/50">
                Imagine two coins that are magically linked. If you flip one and it lands on heads, the other one immediately becomes tails, no matter how far apart they are!
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-border/40 bg-muted/30">
            <div className="h-10 rounded-full bg-background border border-border/60 flex items-center px-4 text-sm text-muted-foreground">
              Ask a follow-up question...
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Headphones,
      label: "Podcast",
      title: "Listen and learn anywhere",
      description: "Turn your notes and documents into engaging audio podcasts. Perfect for studying while commuting or exercising.",
      preview: (
        <div className="flex flex-col items-center justify-center h-full p-6">
          <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-6 shadow-lg border border-white/10 relative overflow-hidden">
             <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,transparent)]" />
             <Mic className="h-10 w-10 text-foreground relative z-10" />
          </div>
          <div className="text-center space-y-2 mb-6">
            <h4 className="font-serif text-lg text-foreground">History of Rome</h4>
            <p className="text-xs text-muted-foreground">Episode 1 • 14 mins remaining</p>
          </div>
          <div className="w-full max-w-xs space-y-4">
             <div className="flex items-center justify-center gap-6">
                <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6-6 6"/></svg>
                </Button>
                <Button size="icon" className="h-14 w-14 rounded-full bg-foreground text-background hover:bg-foreground/90 shadow-xl">
                   <Pause className="h-6 w-6 fill-current" />
                </Button>
                <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 8-6 6 6 6"/></svg>
                </Button>
             </div>
             <div className="flex gap-1 items-end justify-center h-8 px-8">
               {[40, 70, 55, 90, 65, 40, 75, 50, 85, 60].map((h, i) => (
                 <div key={i} className="w-1.5 rounded-full bg-primary/40" style={{ height: `${h}%` }} />
               ))}
             </div>
          </div>
        </div>
      ),
    },
    {
      icon: GraduationCap,
      label: "Essay Grader",
      title: "Improve your writing instantly",
      description: "Get detailed feedback, grading, and suggestions for your essays using advanced AI analysis.",
      preview: (
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <span className="font-serif text-lg text-foreground">Essay Analysis</span>
            <div className="h-8 w-8 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center text-sm font-bold border border-green-500/20">A-</div>
          </div>
          <div className="space-y-4 flex-1">
             <div className="flex gap-3">
               <div className="mt-0.5"><CheckCircle2 className="h-4 w-4 text-green-500" /></div>
               <div>
                 <p className="text-sm font-medium text-foreground">Strong Thesis Statement</p>
                 <p className="text-xs text-muted-foreground">Clear and argumentative.</p>
               </div>
             </div>
             <div className="flex gap-3">
               <div className="mt-0.5"><CheckCircle2 className="h-4 w-4 text-green-500" /></div>
               <div>
                 <p className="text-sm font-medium text-foreground">Good Evidence Usage</p>
                 <p className="text-xs text-muted-foreground">Citations are properly formatted.</p>
               </div>
             </div>
             <div className="flex gap-3">
               <div className="mt-0.5"><Lightbulb className="h-4 w-4 text-yellow-500" /></div>
               <div>
                 <p className="text-sm font-medium text-foreground">Suggestion</p>
                 <p className="text-xs text-muted-foreground">Consider expanding on the counter-argument in paragraph 3.</p>
               </div>
             </div>
          </div>
        </div>
      ),
    },
  ];

  const faqs = [
    {
      q: "Is QuizCraft free to use?",
      a: "Yes! QuizCraft offers a generous free tier with core features. Premium plans unlock additional capabilities like AI-powered flashcards and advanced analytics.",
    },
    {
      q: "How does the AI flashcard system work?",
      a: "Our AI analyzes your learning patterns and uses spaced repetition to show cards right when you're about to forget them, maximizing retention.",
    },
    {
      q: "Is there a student discount?",
      a: "Yes! Students with a valid .edu email get 50% off all premium plans.",
    },
  ];

  return (
    <main className="min-h-screen bg-background overflow-hidden">
      {/* --- FIX: Wrap in Suspense --- */}
      <Suspense fallback={null}>
        <AuthRedirect />
      </Suspense>
      {/* ----------------------------- */}

      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <BookOpen className="h-5 w-5" />
              </div>
              <span className="font-serif text-xl text-foreground tracking-tight">QuizCraft</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Stories
              </a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex rounded-xl text-muted-foreground" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <Button size="sm" className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative container mx-auto px-4 pt-16 pb-24 sm:px-6 lg:px-8 sm:pt-24 sm:pb-32">
        {/* Floating cards */}
        <div
          className="absolute top-20 left-[5%] hidden lg:block animate-float"
          style={{ "--rotate": "-8deg" } as React.CSSProperties}
        >
          <div className="w-52 p-4 rounded-2xl bg-card border border-border/40 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-4 w-4 text-secondary" />
              <span className="text-xs text-muted-foreground">Study streak</span>
            </div>
            <p className="font-serif text-3xl text-foreground">21 days</p>
            <div className="flex gap-1 mt-3">
              {[...Array(7)].map((_, i) => (
                <div key={i} className={`h-2 flex-1 rounded-full ${i < 5 ? "bg-secondary" : "bg-muted"}`} />
              ))}
            </div>
          </div>
        </div>

        <div
          className="absolute top-32 right-[8%] hidden lg:block animate-float-delayed"
          style={{ "--rotate": "6deg" } as React.CSSProperties}
        >
          <div className="w-48 p-4 rounded-2xl bg-card border border-border/40 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Flashcards mastered</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-3xl text-foreground">847</span>
              <span className="text-xs text-secondary">+12 today</span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-40 left-[10%] hidden xl:block animate-float-delayed">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border/40 shadow-lg">
            <div className="h-8 w-8 rounded-full bg-secondary/20 flex items-center justify-center">
              <Trophy className="h-4 w-4 text-secondary" />
            </div>
            <div>
              <p className="text-xs text-foreground font-medium">Achievement unlocked!</p>
              <p className="text-xs text-muted-foreground">7-day streak completed</p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-24 left-[15%] hidden lg:block animate-float">
          <div className="p-3 rounded-xl bg-secondary/20 border border-secondary/30">
            <Coffee className="h-5 w-5 text-secondary-foreground" />
          </div>
        </div>

        <div className="absolute bottom-32 right-[12%] hidden lg:block animate-float-delayed">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <Headphones className="h-5 w-5 text-primary" />
          </div>
        </div>

        <div className="absolute top-48 left-[18%] hidden xl:block animate-float-delayed">
          <div className="p-2.5 rounded-lg bg-muted/60 border border-border/30">
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="absolute top-56 right-[18%] hidden xl:block animate-float">
          <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10">
            <GraduationCap className="h-4 w-4 text-primary/70" />
          </div>
        </div>

        {/* Main hero content */}
        <div className="mx-auto max-w-3xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-muted/60 px-4 py-2 text-sm text-muted-foreground mb-8 border border-border/30">
            <Leaf className="h-4 w-4 text-secondary" />
            <span>Calm, focused learning for students</span>
            <div className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl text-foreground text-balance mb-8 tracking-tight leading-[1.1]">
            Your mind deserves a
            <span className="relative inline-block mx-3">
              <span className="relative z-10">peaceful</span>
              <svg
                className="absolute -bottom-1 left-0 w-full h-3 text-secondary/40"
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
              >
                <path
                  d="M0,8 Q50,0 100,8 T200,8"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            place to grow
          </h1>

          <p className="text-muted-foreground text-lg sm:text-xl leading-relaxed max-w-xl mx-auto mb-10">
            QuizCraft is the warm, distraction-free companion that adapts to how you learn. No chaos. Just clarity.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 text-base font-medium shadow-[0_4px_14px_rgba(0,0,0,0.1)] group"
              asChild
            >
              <Link href="/signup">
                Start for free
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>

          <div className="flex items-center justify-center gap-8 mt-14 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-7 w-7 rounded-full bg-muted border-2 border-background" />
                ))}
              </div>
              <span>
                <AnimatedCounter target={50} suffix="k+" /> students
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-primary text-primary" />
              <span>
                <AnimatedCounter target={4} suffix=".9" /> on App Store
              </span>
            </div>
            <div className="hidden md:flex items-center gap-1.5">
              <Award className="h-4 w-4 text-secondary" />
              <span>Best of 2025</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 sm:py-24">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary/15 px-4 py-2 text-sm text-secondary-foreground mb-6">
            <Sparkles className="h-4 w-4" />
            <span>Powerful features</span>
          </div>
          <h2 className="font-serif text-4xl sm:text-5xl text-foreground text-balance tracking-tight mb-4">
            Tools that feel like home
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Every feature designed with your wellbeing in mind
          </p>
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {features.map((feature, i) => (
              <FeatureTab
                key={i}
                active={activeFeature === i}
                onClick={() => {
                  setActiveFeature(i);
                  setIsPlaying(false);
                }}
                icon={feature.icon}
                label={feature.label}
              />
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1 pl-4 md:pl-0">
              <h3 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight mb-4">
                {features[activeFeature].title}
              </h3>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                {features[activeFeature].description}
              </p>
              <ul className="space-y-3 mb-8">
                {["Customizable settings", "Syncs across devices"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-foreground">
                    <CheckCircle2 className="h-5 w-5 text-secondary flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-1 md:order-2">
              <div className="rounded-3xl bg-card border border-border/60 shadow-[0_20px_60px_rgba(0,0,0,0.08)] overflow-hidden min-h-[380px] sm:min-h-[400px]">
                {features[activeFeature].preview}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 sm:py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: 50000, suffix: "+", label: "Active students", icon: Users },
                { value: 12, suffix: "M+", label: "Study hours logged", icon: Clock },
                { value: 4.9, suffix: "/5", label: "Average rating", icon: Star },
                { value: 98, suffix: "%", label: "Improved grades", icon: TrendingUp },
              ].map((stat, i) => (
                <div key={i} className="relative">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-card border border-border/40 shadow-sm mb-4 mx-auto">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="font-serif text-4xl sm:text-5xl text-foreground mb-2">
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-16 sm:py-24 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <h2 className="font-serif text-4xl text-foreground tracking-tight mb-4">
                Real results from real students
              </h2>
              <p className="text-muted-foreground text-lg">See how QuizCraft transformed their academic journey</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  name: "Alex Thompson",
                  school: "Yale University",
                  before: "C+ Average",
                  after: "A- Average",
                  quote: "I went from struggling to thriving",
                  metric: "+1.2 GPA",
                  image: "A",
                },
                {
                  name: "Priya Sharma",
                  school: "Stanford",
                  before: "2 hrs/day",
                  after: "4.5 hrs/day",
                  quote: "Finally found my study flow",
                  metric: "2.5x focus time",
                  image: "P",
                },
                {
                  name: "Marcus Lee",
                  school: "MIT",
                  before: "50% retention",
                  after: "89% retention",
                  quote: "The flashcards changed everything",
                  metric: "+78% retention",
                  image: "M",
                },
              ].map((story, i) => (
                <div
                  key={i}
                  className="rounded-3xl bg-card border border-border/40 p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] card-hover-lift hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center font-serif text-lg text-primary">
                      {story.image}
                    </div>
                    <div>
                      <p className="font-serif text-foreground">{story.name}</p>
                      <p className="text-xs text-muted-foreground">{story.school}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1 text-center p-3 rounded-xl bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Before</p>
                      <p className="text-sm text-foreground">{story.before}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-secondary flex-shrink-0" />
                    <div className="flex-1 text-center p-3 rounded-xl bg-secondary/15">
                      <p className="text-xs text-muted-foreground mb-1">After</p>
                      <p className="text-sm text-foreground font-medium">{story.after}</p>
                    </div>
                  </div>

                  <p className="text-muted-foreground text-sm mb-4">"{story.quote}"</p>

                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-xs text-primary font-medium">
                    <TrendingUp className="h-3 w-3" />
                    {story.metric}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary mb-6">
              <Zap className="h-4 w-4" />
              <span>Simple pricing</span>
            </div>
            <h2 className="font-serif text-4xl sm:text-5xl text-foreground text-balance tracking-tight mb-4">
              Start free, upgrade when ready
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              No hidden fees. No surprises. Just honest pricing.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Free",
                price: "$0",
                period: "forever",
                desc: "Perfect for getting started",
                features: ["Basic focus timer", "Up to 100 flashcards", "7-day analytics", "1 device"],
                cta: "Get started",
                popular: false,
              },
              {
                name: "Pro",
                price: "$9",
                period: "/month",
                desc: "For serious students",
                features: [
                  "Unlimited flashcards",
                  "AI-powered learning",
                  "Advanced analytics",
                  "Unlimited devices",
                  "Priority support",
                ],
                cta: "Start free trial",
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
                cta: "Contact sales",
                popular: false,
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-3xl p-6 ${plan.popular ? "bg-primary text-primary-foreground ring-2 ring-primary shadow-xl" : "bg-card border border-border/40"} card-hover-lift`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                    Most popular
                  </div>
                )}
                <div className="mb-6">
                  <h3
                    className={`font-serif text-xl mb-2 ${plan.popular ? "text-primary-foreground" : "text-foreground"}`}
                  >
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`font-serif text-4xl ${plan.popular ? "text-primary-foreground" : "text-foreground"}`}
                    >
                      {plan.price}
                    </span>
                    <span className={plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"}>
                      {plan.period}
                    </span>
                  </div>
                  <p
                    className={`text-sm mt-2 ${plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                  >
                    {plan.desc}
                  </p>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm">
                      <CheckCircle2
                        className={`h-4 w-4 flex-shrink-0 ${plan.popular ? "text-primary-foreground" : "text-secondary"}`}
                      />
                      <span className={plan.popular ? "text-primary-foreground" : "text-foreground"}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full rounded-2xl h-12 ${plan.popular ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
                  asChild
                >
                  <Link href="/signup">{plan.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-24 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="font-serif text-4xl text-foreground tracking-tight mb-4">Frequently asked questions</h2>
              <p className="text-muted-foreground">Everything you need to know about QuizCraft</p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-2xl bg-card border border-border/40 overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
                  >
                    <span className="font-medium text-foreground">{faq.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                    />
                  </button>
                  {openFaq === i && <div className="px-5 pb-5 text-muted-foreground">{faq.a}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="relative rounded-[2rem] bg-gradient-to-br from-primary/5 via-card to-secondary/5 border border-border/40 p-8 sm:p-12 text-center overflow-hidden">
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse-soft" />
            <div
              className="absolute bottom-0 right-1/4 w-64 h-64 bg-secondary/10 rounded-full blur-3xl animate-pulse-soft"
              style={{ animationDelay: "1.5s" }}
            />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-secondary/20 px-4 py-2 text-sm text-secondary-foreground mb-6">
                <Heart className="h-4 w-4" />
                <span>Join 50,000+ happy students</span>
              </div>

              <h2 className="font-serif text-4xl sm:text-5xl text-foreground text-balance tracking-tight mb-6">
                Ready to transform how you study?
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
                Start your free account today. No credit card required.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 text-base font-medium shadow-lg group animate-scale-pulse"
                  asChild
                >
                  <Link href="/signup">
                    Start for free
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-2xl h-14 px-8 text-base border-border/60 hover:bg-muted/50 bg-transparent"
                >
                  Schedule a demo
                </Button>
              </div>

              <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span>GDPR compliant</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span>Setup in 2 minutes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/10">
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <BookOpen className="h-5 w-5" />
                </div>
                <span className="font-serif text-xl text-foreground">QuizCraft</span>
              </div>
              <p className="text-muted-foreground text-sm mb-4 max-w-xs">
                The calm, focused study companion that helps you learn better.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-2 rounded-xl bg-muted/50 border border-border/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <Button size="sm" className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                  Subscribe
                </Button>
              </div>
            </div>
            <div>
              <h4 className="font-serif text-foreground mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {["Features", "Pricing", "Integrations", "Updates"].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-foreground transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-serif text-foreground mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {["Blog", "Study Tips", "Help Center", "Community"].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-foreground transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-serif text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/legal/privacy" className="hover:text-foreground transition-colors">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/legal/terms" className="hover:text-foreground transition-colors">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-foreground transition-colors">
                     About
                  </Link>
                </li>
                <li>
                  <Link href="/careers" className="hover:text-foreground transition-colors">
                     Careers
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} QuizCraft. Made with care for students everywhere.</p>
            <div className="flex items-center gap-4">
              {["twitter", "github", "instagram"].map((social) => (
                <a key={social} href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <div className="h-5 w-5 rounded bg-muted-foreground/20" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}