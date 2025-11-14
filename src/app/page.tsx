// src/app/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/theme-toggle";
// import { Footer } from "@/components/Footer"; // <-- REMOVE THIS LINE
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  Sparkles,
  FileText,
  MessageSquare,
  FileQuestion,
  Layers,
  PenTool,
  FolderKanban,
  CheckCircle2,
  Upload,
  BrainCircuit,
  GraduationCap,
} from "lucide-react";

// --- Components ---

function LandingHeader() {
  const { user, loading } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="bg-primary text-primary-foreground p-1 rounded-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">QuizCraft</span>
        </Link>
        
        <nav className="flex items-center gap-4">
          <ThemeToggle />
          {!loading && (
            <>
              {user ? (
                <Button onClick={() => router.push("/documents")}>
                  My Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" asChild className="hidden sm:inline-flex">
                    <Link href="/login">Log In</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/signup">Get Started</Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-muted bg-card/50 hover:bg-card transition-colors duration-300">
      <CardHeader>
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
          {icon}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

function StepCard({
  number,
  title,
  description,
  icon,
}: {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center p-6">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
          {icon}
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold border-4 border-background">
          {number}
        </div>
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}

// --- Main Page ---

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleGetStarted = () => {
    if (loading) return;
    if (user) {
      router.push("/documents"); // Default to documents if logged in
    } else {
      router.push("/signup"); // Go to signup if not logged in
    }
  };

  return (
    <div className="flex flex-col min-h-screen font-sans">
      <LandingHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
          <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]"></div>
          
          <div className="container mx-auto px-4 md:px-6 text-center">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-8 backdrop-blur-sm">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              <span>Now with AI Essay Grading</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground mb-6 max-w-5xl mx-auto leading-[1.1]">
              Your Personal <span className="text-primary">AI Tutor</span> & <br className="hidden sm:block" /> Study Partner
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Upload any document, PDF, or note and instantly generate quizzes, 
              flashcards, and summaries. Save hours of study time today.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="h-12 px-8 text-base rounded-full" onClick={handleGetStarted}>
                  Start Studying for Free
                  <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              {!user && !loading && (
                <Button size="lg" variant="outline" className="h-12 px-8 text-base rounded-full" asChild>
                  <Link href="/login">
                    Log In
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-24 bg-muted/30">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to ace exams</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                QuizCraft transforms your raw study materials into interactive learning tools automatically.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              <FeatureCard
                icon={<MessageSquare className="w-6 h-6" />}
                title="Chat with Documents"
                description="Upload PDFs or docs and ask questions. Get instant, cited answers directly from your study materials."
              />
              <FeatureCard
                icon={<FileQuestion className="w-6 h-6" />}
                title="Instant Quizzes"
                description="Generate multiple-choice, true/false, and fill-in-the-blank quizzes from any text in seconds."
              />
              <FeatureCard
                icon={<Layers className="w-6 h-6" />}
                title="Smart Flashcards"
                description="Convert notes into flashcard decks. Use our spaced-repetition mode to memorize facts faster."
              />
              <FeatureCard
                icon={<FileText className="w-6 h-6" />}
                title="AI Summarizer"
                description="Paste complex text or URLs to get concise, structured notes on the key concepts and definitions."
              />
              <FeatureCard
                icon={<PenTool className="w-6 h-6" />}
                title="Essay Grader"
                description="Get instant feedback on your writing. Our AI provides scores, highlights, and actionable advice."
              />
              <FeatureCard
                icon={<FolderKanban className="w-6 h-6" />}
                title="Project Organization"
                description="Group related documents, quizzes, and decks into projects to keep your courses organized."
              />
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">From notes to knowledge in minutes</h2>
              <p className="text-lg text-muted-foreground">Three simple steps to master any subject.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
              {/* Connector Line (Desktop only) */}
              <div className="hidden md:block absolute top-14 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent -z-10" />
              
              <StepCard 
                number="1"
                title="Upload Material"
                description="Drag & drop your PDFs, documents, or paste text directly into the app."
                icon={<Upload className="w-8 h-8" />}
              />
              <StepCard 
                number="2"
                title="AI Generation"
                description="Our AI analyzes your content to create quizzes, notes, and study aids."
                icon={<BrainCircuit className="w-8 h-8" />}
              />
              <StepCard 
                number="3"
                title="Master It"
                description="Test yourself, track your progress, and improve with instant feedback."
                icon={<GraduationCap className="w-8 h-8" />}
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-primary/5 border-t border-b border-primary/10">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">
              Ready to upgrade your grades?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
              Join thousands of students using AI to study smarter, not harder. 
              Get started today for free.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
               <Button size="lg" className="h-12 px-8 rounded-full text-lg shadow-lg shadow-primary/20" onClick={handleGetStarted}>
                  Get Started Now <ArrowRight className="ml-2 h-5 w-5" />
               </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> No credit card required
              <span className="mx-2">•</span>
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Free plan available
            </p>
          </div>
        </section>
      </main>
      
      {/* Footer is provided by the root layout */}
    </div>
  );
}