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
} from "lucide-react";

// --- Sub-Components ---

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
    <Card className="group relative border-muted bg-card/50 transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardHeader className="relative z-10">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
          {icon}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
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
    <div className="flex flex-col items-center text-center p-6 rounded-xl transition-all duration-300 ease-in-out hover:scale-105 hover:bg-card/60 relative group">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 bg-background/50 backdrop-blur-sm">
          {icon}
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold border-4 border-background z-10">
          {number}
        </div>
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-muted-foreground max-w-sm">{description}</p>
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
    <Card className="h-full flex flex-col bg-card/50 border-muted shadow-lg hover:border-primary/20 transition-colors">
      <CardContent className="pt-6 flex-1">
        <blockquote className="text-lg leading-relaxed text-foreground">
          "{quote}"
        </blockquote>
      </CardContent>
      <CardFooter>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-purple-600 text-white flex items-center justify-center shadow-md">
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

// --- Main Page Component ---

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen font-sans bg-background text-foreground selection:bg-primary/20">
      <LandingHeader />

      <main className="flex-1">
        {/* --- HERO SECTION --- */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          
          {/* Animated Background Layers */}
          <div className="absolute inset-0 w-full h-full -z-20 bg-background" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

          {/* THE AURORA BLOBS */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[500px] -z-10 opacity-60 dark:opacity-40">
            <div className="absolute top-0 left-1/4 w-72 h-72 bg-primary/40 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl animate-blob" />
            <div className="absolute top-0 right-1/4 w-72 h-72 bg-indigo-500/40 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl animate-blob animation-delay-2000" />
            <div className="absolute -bottom-8 left-1/3 w-72 h-72 bg-pink-500/40 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl animate-blob animation-delay-4000" />
          </div>
          
          <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-background/50 backdrop-blur-sm px-3 py-1 text-sm font-medium text-primary mb-8 shadow-sm hover:bg-background/80 transition-colors cursor-default">
              <Sparkles className="mr-2 h-3.5 w-3.5 animate-pulse" />
              <span>Now with AI Essay Grading</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground mb-6 max-w-5xl mx-auto leading-[1.1]">
              Your Personal{" "}
              {/* --- UPDATED: ANIMATED AURORA TEXT --- */}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-[length:200%_auto] animate-aurora-text">
                AI Tutor
              </span>{" "}
              & <br className="hidden sm:block" /> Study Partner
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Upload any document, PDF, or note and instantly generate quizzes, 
              flashcards, and summaries. Save hours of study time today.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="h-12 px-8 text-base rounded-full shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-105" asChild>
                <Link href="/signup">
                  Start Studying for Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base rounded-full border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors" asChild>
                <Link href="/login">
                  Log In
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-24 bg-gradient-to-b from-transparent to-muted/30">
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
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-primary/5 rounded-full blur-[100px] -z-10" />
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">From notes to knowledge in minutes</h2>
              <p className="text-lg text-muted-foreground">Three simple steps to master any subject.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
              <div className="hidden md:block absolute top-14 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent -z-10" />
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

        {/* Use Cases Section */}
        <section className="py-24 bg-muted/30">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">For Every Kind of Learner</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Whether you're a student or a professional, QuizCraft adapts to your needs.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <Card className="border-muted/60 shadow-md">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-3">
                    <GraduationCap className="w-8 h-8 text-primary" />
                    For Students
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Turn lecture notes and textbook chapters into study sets in seconds. Stop wasting time on manual prep and focus on what matters: learning.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span>Instantly create study guides from notes.</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span>Chat with your syllabus or readings.</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span>Ace exams with practice quizzes and flashcards.</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="border-muted/60 shadow-md">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-3">
                    <Briefcase className="w-8 h-8 text-primary" />
                    For Educators & Professionals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Quickly create training materials, onboard new hires, or refresh your knowledge on technical documents.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span>Generate test questions for any topic.</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span>Summarize dense reports and technical manuals.</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span>Create flashcards for corporate training.</span>
                    </li>
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
                quote="The 'Chat with Document' feature is incredible. I can ask my textbook specific questions and get answers instantly. Saved me hours of searching."
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
                <AccordionTrigger className="text-lg">Is QuizCraft free to use?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  Yes! QuizCraft offers a generous free plan that includes access to all core features, including document uploads, quiz generation, and AI chat. We have fair usage limits on the free plan, with an option to upgrade to Pro for unlimited access.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger className="text-lg">What file types are supported?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  You can upload `.pdf`, `.docx` (Word), `.pptx` (PowerPoint), and `.txt` files. You can also paste text directly or provide a URL for our AI to summarize.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger className="text-lg">How does the AI Essay Grader work?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  Our AI Essay Grader analyzes your text based on standard academic criteria like clarity, argumentation, and grammar. It provides an estimated score (0-100) and detailed feedback with highlights, helping you understand your strengths and areas for improvement.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger className="text-lg">Is my data secure?</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  Yes. Your data is stored securely in your own private Supabase database. We do not share your documents or personal information with any third parties. All AI processing is done anonymously.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-24 bg-primary/5 border-t border-primary/10 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-primary/20 to-purple-500/20 rounded-full blur-[120px] -z-10" />

          <div className="container mx-auto px-4 md:px-6 text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">
              Ready to upgrade your grades?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
              Join thousands of students using AI to study smarter, not harder. 
              Get started today for free.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
               <Button size="lg" className="h-12 px-8 rounded-full text-lg shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-105" asChild>
                <Link href="/signup">
                  Get Started Now <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
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

      {/* Footer is provided by src/app/layout.tsx */}
    </div>
  );
}