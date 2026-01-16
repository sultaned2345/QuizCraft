"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AnimatedCounter } from "@/components/landing/animated-counter"
import { FeatureTab } from "@/components/landing/feature-tab"
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
  Coffee,
  Headphones,
  BarChart3,
  Play,
  Laptop,
  Smartphone,
  Calendar,
  Bell,
  FileText,
  Layers,
  TrendingUp,
  GraduationCap,
  Lightbulb,
  Check,
  X,
  Globe,
  Pause,
  Timer,
  Flame,
  Trophy,
  Download,
  Volume2,
  Settings,
  Search,
  Plus,
  MoreHorizontal,
  ArrowUpRight,
  ChevronDown,
  Heart,
  Shield,
} from "lucide-react"

export default function LandingPage() {
  const [activeFeature, setActiveFeature] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    if (!isPlaying) return
    const timer = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 4)
    }, 4000)
    return () => clearInterval(timer)
  }, [isPlaying])

  const features = [
    {
      icon: Clock,
      label: "Focus Timer",
      title: "Deep work sessions",
      description: "Pomodoro-style timers that adapt to your natural rhythm. Take breaks when you need them.",
      preview: (
        <div className="flex flex-col items-center justify-center h-full py-8">
          <span className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Current Session</span>
          <div className="font-serif text-7xl text-foreground mb-2">24:38</div>
          <div className="text-sm text-secondary mb-6">Biology Chapter 12</div>
          <div className="flex gap-3">
            <button className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
              <Pause className="h-5 w-5 text-primary" />
            </button>
            <button className="h-12 w-12 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
              <Timer className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
          <div className="mt-6 flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`h-2 w-12 rounded-full ${i <= 3 ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: Brain,
      label: "Flashcards",
      title: "Smarter memorization",
      description: "AI-powered spaced repetition that knows what you need to review and when.",
      preview: (
        <div className="relative h-full flex items-center justify-center py-8">
          <div className="absolute w-64 h-40 rounded-2xl bg-muted -rotate-6 -translate-x-4 translate-y-2" />
          <div className="absolute w-64 h-40 rounded-2xl bg-muted/70 rotate-3 translate-x-2 -translate-y-1" />
          <div className="relative w-72 h-44 rounded-2xl bg-card border border-border/60 shadow-lg p-6 flex flex-col justify-between">
            <div className="text-xs text-muted-foreground">Tap to flip</div>
            <div className="font-serif text-xl text-foreground text-center">What is the mitochondria?</div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-secondary">Biology</span>
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-secondary" />
                <div className="h-2 w-2 rounded-full bg-secondary" />
                <div className="h-2 w-2 rounded-full bg-muted" />
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Target,
      label: "Goals",
      title: "Track your progress",
      description: "Set intentions and watch your consistency grow without pressure or guilt.",
      preview: (
        <div className="p-6 h-full">
          <div className="flex items-center justify-between mb-6">
            <span className="font-serif text-lg text-foreground">This Week</span>
            <span className="text-sm text-secondary">85% complete</span>
          </div>
          <div className="space-y-4">
            {[
              { label: "Study 20 hours", progress: 90, color: "primary" },
              { label: "Review 100 cards", progress: 75, color: "secondary" },
              { label: "Complete 5 chapters", progress: 80, color: "primary" },
            ].map((goal, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-foreground">{goal.label}</span>
                  <span className="text-muted-foreground">{goal.progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${goal.color === "primary" ? "bg-primary" : "bg-secondary"}`}
                    style={{ width: `${goal.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: BarChart3,
      label: "Analytics",
      title: "Understand your patterns",
      description: "Gentle insights that help you study smarter, not harder.",
      preview: (
        <div className="p-6 h-full">
          <div className="flex items-center justify-between mb-6">
            <span className="font-serif text-lg text-foreground">Study Insights</span>
            <span className="text-xs text-muted-foreground">Last 7 days</span>
          </div>
          <div className="flex items-end justify-between h-32 mb-4">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => {
              const heights = [45, 70, 55, 85, 65, 40, 75]
              return (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div
                    className="w-8 rounded-t-lg bg-primary/20 hover:bg-primary/40 transition-colors"
                    style={{ height: `${heights[i]}%` }}
                  />
                  <span className="text-xs text-muted-foreground">{day}</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-secondary" />
              <span className="text-foreground">21 day streak</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-foreground">+15% this week</span>
            </div>
          </div>
        </div>
      ),
    },
  ]

  const faqs = [
    {
      q: "Is StudySpace free to use?",
      a: "Yes! StudySpace offers a generous free tier with core features. Premium plans unlock additional capabilities like AI-powered flashcards and advanced analytics.",
    },
    {
      q: "Can I use it offline?",
      a: "Absolutely. Our mobile apps work fully offline, syncing your progress when you reconnect.",
    },
    {
      q: "How does the AI flashcard system work?",
      a: "Our AI analyzes your learning patterns and uses spaced repetition to show cards right when you're about to forget them, maximizing retention.",
    },
    {
      q: "Is there a student discount?",
      a: "Yes! Students with a valid .edu email get 50% off all premium plans.",
    },
  ]

  return (
    <main className="min-h-screen bg-background overflow-hidden">
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
              <a href="#demo" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Demo
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
            StudySpace is the warm, distraction-free companion that adapts to how you learn. No chaos. Just clarity.
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
            <Button
              variant="ghost"
              size="lg"
              className="rounded-2xl h-14 px-8 text-base text-muted-foreground hover:text-foreground group"
            >
              <Play className="mr-2 h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              Watch demo
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

      {/* As Featured In */}
      <section className="py-10 border-y border-border/30 bg-muted/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-muted-foreground mb-6">As featured in</p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {["TechCrunch", "The Verge", "Wired", "Forbes", "Fast Company"].map((pub) => (
              <span
                key={pub}
                className="font-serif text-lg text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                {pub}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* University Marquee */}
      <section className="py-10 border-b border-border/30 bg-muted/20 overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <p className="text-center text-sm text-muted-foreground">Trusted by students at top universities</p>
        </div>
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-muted/20 to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-muted/20 to-transparent z-10" />
          <div className="flex animate-marquee">
            {[...Array(2)].map((_, setIndex) => (
              <div key={setIndex} className="flex gap-16 px-8">
                {[
                  "Harvard",
                  "Stanford",
                  "MIT",
                  "Yale",
                  "Princeton",
                  "Columbia",
                  "Oxford",
                  "Cambridge",
                  "Berkeley",
                  "UCLA",
                ].map((uni) => (
                  <div key={`${setIndex}-${uni}`} className="flex-none">
                    <span className="font-serif text-xl text-muted-foreground/60 whitespace-nowrap">{uni}</span>
                  </div>
                ))}
              </div>
            ))}
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

        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {features.map((feature, i) => (
              <FeatureTab
                key={i}
                active={activeFeature === i}
                onClick={() => {
                  setActiveFeature(i)
                  setIsPlaying(false)
                }}
                icon={feature.icon}
                label={feature.label}
              />
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1">
              <h3 className="font-serif text-3xl text-foreground tracking-tight mb-4">
                {features[activeFeature].title}
              </h3>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                {features[activeFeature].description}
              </p>
              <ul className="space-y-3 mb-8">
                {["Customizable settings", "Works offline", "Syncs across devices"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-foreground">
                    <CheckCircle2 className="h-5 w-5 text-secondary flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6 group">
                Learn more
                <ArrowUpRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Button>
            </div>
            <div className="order-1 md:order-2">
              <div className="rounded-3xl bg-card border border-border/60 shadow-[0_20px_60px_rgba(0,0,0,0.08)] overflow-hidden min-h-[320px]">
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

      {/* Product Demo */}
      <section id="demo" className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary/15 px-4 py-2 text-sm text-secondary-foreground mb-6">
              <Play className="h-4 w-4" />
              <span>See it in action</span>
            </div>
            <h2 className="font-serif text-4xl sm:text-5xl text-foreground text-balance tracking-tight mb-4">
              A study experience you'll love
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Watch how StudySpace transforms your learning journey
            </p>
          </div>

          <div className="relative mx-auto max-w-4xl">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-secondary/20 rounded-[2rem] blur-3xl opacity-50" />

            <div className="relative rounded-[2rem] bg-card border border-border/60 shadow-[0_20px_60px_rgba(0,0,0,0.1)] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-destructive/60" />
                  <div className="h-3 w-3 rounded-full bg-secondary/60" />
                  <div className="h-3 w-3 rounded-full bg-primary/60" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-background/60 text-xs text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    app.studyspace.com
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10">
                      <Clock className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium text-foreground">Focus Mode</span>
                    </div>
                    {[
                      { icon: Brain, label: "Flashcards" },
                      { icon: FileText, label: "Notes" },
                      { icon: Calendar, label: "Schedule" },
                      { icon: BarChart3, label: "Analytics" },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <item.icon className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                      </div>
                    ))}
                    <div className="pt-4 border-t border-border/40">
                      <button className="w-full flex items-center gap-2 p-3 rounded-xl bg-secondary/10 hover:bg-secondary/20 transition-colors text-sm text-secondary-foreground">
                        <Plus className="h-4 w-4" />
                        <span>Quick Add</span>
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-6">
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground mb-2">Deep Focus Session</p>
                      <p className="font-serif text-6xl text-foreground tracking-tight">24:38</p>
                      <p className="text-xs text-secondary mt-2">Biology Study Session</p>
                      <div className="flex items-center justify-center gap-4 mt-6">
                        <button className="h-10 w-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                          <Volume2 className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button className="h-14 w-14 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg">
                          <Pause className="h-6 w-6 text-primary-foreground" />
                        </button>
                        <button className="h-10 w-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Session progress</span>
                        <span className="text-foreground">3 of 4 pomodoros</span>
                      </div>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className={`flex-1 h-2 rounded-full ${i <= 3 ? "bg-primary/80" : "bg-muted"}`} />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { value: "2.5h", label: "Today" },
                        { value: "47", label: "Cards reviewed" },
                        { value: "12", label: "Day streak" },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-xl bg-muted/50 text-center hover:bg-muted/70 transition-colors cursor-pointer"
                        >
                          <p className="font-serif text-2xl text-foreground">{item.value}</p>
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -left-4 top-1/4 hidden lg:block animate-float">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border/60 shadow-lg">
                <Bell className="h-4 w-4 text-secondary" />
                <span className="text-xs text-foreground">Gentle reminders</span>
              </div>
            </div>
            <div className="absolute -right-4 top-1/3 hidden lg:block animate-float-delayed">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border/60 shadow-lg">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-xs text-foreground">Smart insights</span>
              </div>
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
              <p className="text-muted-foreground text-lg">See how StudySpace transformed their academic journey</p>
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

      {/* Platforms */}
      <section className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-serif text-4xl text-foreground tracking-tight mb-6">Study anywhere, on any device</h2>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                Your study progress syncs seamlessly across all your devices. Start a session on your laptop, continue
                on your phone.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Laptop, text: "Web app for focused desktop study" },
                  { icon: Smartphone, text: "iOS & Android apps with offline mode" },
                  { icon: Layers, text: "Browser extension for quick captures" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-card border border-border/40 flex items-center justify-center shadow-sm">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-foreground">{item.text}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-8">
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background text-sm hover:opacity-90 transition-opacity">
                  <Download className="h-4 w-4" />
                  <div className="text-left">
                    <p className="text-xs opacity-80">Download on</p>
                    <p className="font-medium">App Store</p>
                  </div>
                </button>
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background text-sm hover:opacity-90 transition-opacity">
                  <Download className="h-4 w-4" />
                  <div className="text-left">
                    <p className="text-xs opacity-80">Get it on</p>
                    <p className="font-medium">Google Play</p>
                  </div>
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 to-primary/20 rounded-3xl blur-2xl opacity-50" />
              <div className="relative grid grid-cols-2 gap-4">
                <div className="col-span-2 p-4 rounded-2xl bg-card border border-border/40 shadow-lg card-hover-lift">
                  <div className="aspect-video rounded-lg bg-muted/50 flex items-center justify-center">
                    <div className="text-center">
                      <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
                      <span className="font-serif text-2xl text-foreground">25:00</span>
                    </div>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-card border border-border/40 shadow-lg card-hover-lift">
                  <div className="aspect-[9/16] rounded-lg bg-muted/50 flex items-center justify-center">
                    <Brain className="h-6 w-6 text-secondary" />
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-card border border-border/40 shadow-lg card-hover-lift">
                  <div className="aspect-[9/16] rounded-lg bg-muted/50 flex items-center justify-center">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-16 sm:py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <h2 className="font-serif text-4xl text-foreground tracking-tight mb-4">
                Why students choose QuizCraft
              </h2>
              <p className="text-muted-foreground text-lg">See how we compare to other study apps</p>
            </div>

            <div className="rounded-3xl bg-card border border-border/40 overflow-hidden shadow-lg">
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted/30 border-b border-border/40">
                <div className="text-sm font-medium text-foreground">Feature</div>
                <div className="text-sm font-medium text-foreground text-center">QuizCraft</div>
                <div className="text-sm text-muted-foreground text-center">App A</div>
                <div className="text-sm text-muted-foreground text-center">App B</div>
              </div>
              {[
                { feature: "Calm, distraction-free design", us: true, a: false, b: false },
                { feature: "AI-powered flashcards", us: true, a: true, b: false },
                { feature: "Offline mode", us: true, a: false, b: true },
                { feature: "Cross-device sync", us: true, a: true, b: true },
                { feature: "Focus timer with breaks", us: true, a: true, b: false },
                { feature: "Student discount", us: true, a: false, b: false },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 p-4 border-b border-border/20 last:border-0">
                  <div className="text-sm text-foreground">{row.feature}</div>
                  <div className="text-center">
                    {row.us ? (
                      <Check className="h-5 w-5 text-secondary mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                    )}
                  </div>
                  <div className="text-center">
                    {row.a ? (
                      <Check className="h-5 w-5 text-muted-foreground/60 mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                    )}
                  </div>
                  <div className="text-center">
                    {row.b ? (
                      <Check className="h-5 w-5 text-muted-foreground/60 mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                    )}
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
                  "Offline mode",
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
              <p className="text-muted-foreground">Everything you need to know about StudySpace</p>
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
                {["About", "Careers", "Privacy", "Terms"].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-foreground transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">© 2026 QuizCraft. Made with care for students everywhere.</p>
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
  )
}