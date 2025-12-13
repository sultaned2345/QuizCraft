// src/app/page.tsx
import Link from "next/link";
import { LandingHeader } from "@/components/LandingHeader";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  User,
  Briefcase,
  Star,
  Zap,
} from "lucide-react";

// --- Sub-Components for the Page (Server Components) ---

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
    // --- REFINEMENT: Added 'group' for coordinated hover effects and border hover color ---
    <Card className="group border-muted bg-card/50 transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-lg hover:border-primary/20 hover:bg-card">
      <CardHeader>
        {/* Icon animates on card hover */}
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:bg-primary/20">
          {icon}
        </div>
        <CardTitle className="text-xl group-hover:text-primary transition-colors duration-300">
          {title}
        </CardTitle>
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
    <div className="relative flex flex-col items-center text-center p-6 rounded-2xl transition-all duration-300 hover:bg-muted/50 z-10">
      <div className="relative mb-6 group">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:scale-105">
          {icon}
        </div>
        <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm border-4 border-background shadow-sm">
          {number}
        </div>
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-muted-foreground max-w-sm text-sm md:text-base">{description}</p>
    </div>
  );
}

function TestimonialCard({
  quote,
  name,
  title,
}: {
  quote: string;
  name: string;
  title: string;
}) {
  return (
    <Card className="h-full flex flex-col bg-card/50 border-muted shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardContent className="pt-6 flex-1 space-y-4">
        {/* Added 5-star rating for social proof */}
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star key={star} className="w-4 h-4 text-amber-400 fill-amber-400" />
          ))}
        </div>
        <blockquote className="text-lg leading-relaxed text-foreground/90 italic">
          "{quote}"
        </blockquote>
      </CardContent>
      <CardFooter className="border-t pt-4 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary/20 to-primary/10 text-primary flex items-center justify-center font-bold">
            {name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-sm">{name}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

// --- Main Page Component (Server Component) ---

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen font-sans selection:bg-primary/20">
      <LandingHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          {/* Background Elements - Lightweight CSS only */}
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
          
          {/* Primary Glow */}
          <div className="absolute left-0 right-0 top-[-10%] -z-10 m-auto h-[400px] w-[400px] rounded-full bg-primary/20 opacity-20 blur-[100px] animate-pulse"></div>
          {/* Secondary Glow for asymmetry */}
          <div className="absolute right-[10%] bottom-[10%] -z-10 h-[250px] w-[250px] rounded-full bg-blue-500/10 opacity-20 blur-[80px]"></div>

          <div className="container mx-auto px-4 md:px-6 text-center">
            {/* Announcement Badge */}
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-background/50 px-3 py-1 text-sm font-medium text-primary mb-8 backdrop-blur-md shadow-sm hover:bg-primary/5 transition-colors cursor-default">
              <Sparkles className="mr-2 h-3.5 w-3.5 fill-primary/20" />
              <span>New: AI Essay Grading Feature</span>
            </div>
            
            {/* Main Headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground mb-6 max-w-5xl mx-auto leading-[1.1]">
              Your Personal <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">AI Tutor</span> <br className="hidden sm:block" />
              & Study Partner
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Upload any document, PDF, or note and instantly generate quizzes, 
              flashcards, and summaries. <span className="text-foreground font-medium">Study smarter, not harder.</span>
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Button size="lg" className="h-12 px-8 text-base rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all" asChild>
                <Link href="/signup">
                  Start Studying for Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base rounded-full hover:bg-muted/50" asChild>
                <Link href="/login">
                  Log In
                </Link>
              </Button>
            </div>

            {/* Simple Trust Stats - Lightweight social proof */}
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>No Credit Card</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span>Instant Results</span>
              </div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-muted-foreground/30" />
              <div className="hidden sm:flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" />
                <span>10k+ Students</span>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-24 bg-muted/30 relative">
          {/* Subtle separator */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
          
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
        <section className="py-24 bg-background relative overflow-hidden">
           <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">From notes to knowledge in minutes</h2>
              <p className="text-lg text-muted-foreground">Three simple steps to master any subject.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
              {/* Connector Line (Desktop only) */}
              <div className="hidden md:block absolute top-14 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-muted via-primary/20 to-muted -z-10" />
              
              <StepCard 
                number="1"
                title="Upload Material"
                description="Drag & drop your PDFs, documents, or paste text directly into the app."
                icon={<Upload className="w-7 h-7" />}
              />
              <StepCard 
                number="2"
                title="AI Generation"
                description="Our AI analyzes your content to create quizzes, notes, and study aids."
                icon={<BrainCircuit className="w-7 h-7" />}
              />
              <StepCard 
                number="3"
                title="Master It"
                description="Test yourself, track your progress, and improve with instant feedback."
                icon={<GraduationCap className="w-7 h-7" />}
              />
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="py-24 bg-muted/30 border-y border-muted/50">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <Card className="bg-background/60 backdrop-blur-sm border-muted/60">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        <GraduationCap className="w-6 h-6" />
                    </div>
                    For Students
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Turn lecture notes and textbook chapters into study sets in seconds. Stop wasting time on manual prep.
                  </p>
                  <ul className="space-y-3 pt-2">
                    {["Create study guides from notes", "Chat with syllabus & readings", "Practice with auto-generated exams"].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm font-medium">
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        <span>{item}</span>
                        </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-background/60 backdrop-blur-sm border-muted/60">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                        <Briefcase className="w-6 h-6" />
                    </div>
                    For Educators
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Quickly create training materials, onboard new hires, or refresh your knowledge on technical documents.
                  </p>
                  <ul className="space-y-3 pt-2">
                    {["Generate banks of test questions", "Summarize dense reports", "Create training flashcards"].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm font-medium">
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        <span>{item}</span>
                        </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Don't just study. Understand.</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                See what other learners are saying about QuizCraft.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <TestimonialCard
                quote="I uploaded a 40-page PDF on biology and had a practice quiz in 30 seconds. This is a game-changer for midterms."
                name="Sarah J."
                title="University Student"
              />
              <TestimonialCard
                quote="The 'Chat with Document' feature is incredible. I can ask my textbook specific questions and get answers instantly."
                name="Michael B."
                title="Grad Student"
              />
              <TestimonialCard
                quote="As a teacher, I use this to generate question banks from my lesson plans. What used to take an hour now takes a minute."
                name="David L."
                title="High School Educator"
              />
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24 bg-muted/30">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            </div>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-lg hover:text-primary transition-colors">Is QuizCraft free to use?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  Yes! QuizCraft offers a generous free plan that includes access to all core features, including document uploads, quiz generation, and AI chat.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger className="text-lg hover:text-primary transition-colors">What file types are supported?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  You can upload `.pdf`, `.docx` (Word), `.pptx` (PowerPoint), and `.txt` files. You can also paste text directly or provide a URL for our AI to summarize.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger className="text-lg hover:text-primary transition-colors">How does the AI Essay Grader work?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  Our AI Essay Grader analyzes your text based on standard academic criteria like clarity, argumentation, and grammar. It provides an estimated score (0-100) and detailed feedback with highlights.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger className="text-lg hover:text-primary transition-colors">Is my data secure?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  Yes. Your data is stored securely in your own private Supabase database. We do not share your documents or personal information with any third parties.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-primary/5 border-t border-b border-primary/10 relative overflow-hidden">
          {/* Decorative Circle */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>

          <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">
              Ready to upgrade your grades?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
              Join thousands of students using AI to study smarter, not harder. 
              Get started today for free.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
               <Button size="lg" className="h-12 px-8 rounded-full text-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all" asChild>
                <Link href="/signup">
                  Get Started Now <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
               </Button>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
               <span className="flex items-center gap-2">
                 <CheckCircle2 className="w-4 h-4 text-green-500" /> No credit card required
               </span>
               <span className="hidden sm:inline">•</span>
               <span className="flex items-center gap-2">
                 <CheckCircle2 className="w-4 h-4 text-green-500" /> Free plan available
               </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}