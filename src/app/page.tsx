import Link from "next/link";
import { LandingHeader } from "@/components/LandingHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Sparkles,
  User,
  CheckCircle2,
  Globe,
  Smartphone,
  Download
} from "lucide-react";

// --- New Components ---
import { BentoGrid } from "@/components/landing/BentoGrid";
import { BrainToQuizSection } from "@/components/landing/BrainToQuizSection";

// --- Aurora Background Component (Local) ---
function AuroraBackground() {
  return (
    <div className="absolute inset-0 -z-20 overflow-hidden pointer-events-none">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] animate-aurora-1 opacity-50" />
      <div className="absolute top-[20%] right-[-10%] w-[30%] h-[50%] rounded-full bg-blue-500/10 blur-[100px] animate-aurora-2 opacity-40" />
      <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[40%] rounded-full bg-purple-500/15 blur-[120px] animate-aurora-3 opacity-40" />
    </div>
  );
}

// --- Sub-Components ---

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
    <Card className="h-full flex flex-col bg-card/40 backdrop-blur-sm border-white/10 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardContent className="pt-6 flex-1">
        <blockquote className="text-lg leading-relaxed text-foreground/90">
          "{quote}"
        </blockquote>
      </CardContent>
      <CardFooter>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
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
    <div className="flex flex-col min-h-screen font-sans relative selection:bg-primary/20">
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
              Turn Notes into Knowledge in <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-blue-600 animate-pulse">
                Minutes, Not Hours
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
              Stop highlighting endless PDFs. Transform your raw study materials into 
              interactive quizzes and flashcards instantly.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-105"
                asChild
              >
                <Link href="/signup">
                  Start Studying for Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-8 text-lg rounded-full bg-background/50 backdrop-blur-sm border-primary/20 hover:bg-background/80"
                asChild
              >
                <Link href="/login">Log In</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* NEW: Logo Cloud / Trusted By */}
        <section className="py-8 border-y border-white/5 bg-white/5 backdrop-blur-sm">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm font-semibold text-muted-foreground mb-6 uppercase tracking-wider">
              Trusted by students from top universities
            </p>
            <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
               {/* Placeholders for logos - simplified text for now */}
               <span className="text-xl font-bold font-serif">Harvard</span>
               <span className="text-xl font-bold font-serif">Stanford</span>
               <span className="text-xl font-bold font-serif">MIT</span>
               <span className="text-xl font-bold font-serif">Berkeley</span>
               <span className="text-xl font-bold font-serif">Oxford</span>
            </div>
          </div>
        </section>

        {/* Brain to Quiz Animation */}
        <BrainToQuizSection />

        {/* Bento Grid Features */}
        <BentoGrid />

        {/* Testimonials Section */}
        <section className="py-24 bg-transparent">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Don't just study. Understand.
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                See what other learners are saying about QuizCraft.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <TestimonialCard
                quote="I used to spend 5 hours making flashcards for Biology. Yesterday I did it in 3 minutes. The time saved alone pays for the subscription."
                name="Sarah J."
                title="University Student"
              />
              <TestimonialCard
                quote="I was skeptical about AI summaries, but QuizCraft caught nuances in my History lectures that I completely missed. It’s like having a TA in my pocket."
                name="Michael B."
                title="Grad Student"
              />
              <TestimonialCard
                quote="Works perfectly for technical Engineering PDFs. It handles formulas and diagrams better than any other tool I've tried."
                name="David L."
                title="Engineering Major"
              />
            </div>
          </div>
        </section>

        {/* FAQ Section - EXPANDED */}
        <section className="py-24 bg-muted/20 backdrop-blur-sm">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Frequently Asked Questions
              </h2>
            </div>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-lg">
                  Is QuizCraft free to use?
                </AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  Yes! QuizCraft offers a generous free plan that includes Free forever for up to 3 documents a month.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger className="text-lg">
                  Can I trust the AI answers?
                </AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  We use advanced AI and always cite the page number from your document so you can verify facts instantly.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger className="text-lg">
                  How does the AI Essay Grader work?
                </AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  Our AI Essay Grader analyzes your text based on standard
                  academic criteria like clarity, argumentation, and grammar. It
                  provides an estimated score (0-100) and detailed feedback.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger className="text-lg">
                  Is my data secure?
                </AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  Yes. Your data is stored securely in your own private Supabase
                  database. We do not share your documents with any third parties.
                </AccordionContent>
              </AccordionItem>
              {/* NEW QUESTIONS */}
              <AccordionItem value="item-5">
                <AccordionTrigger className="text-lg flex gap-2 items-center">
                   <Smartphone className="w-5 h-5 text-primary" /> Does it work on mobile?
                </AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  Absolutely. QuizCraft is fully responsive, so you can review flashcards or take quizzes on your phone while commuting or between classes.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-6">
                <AccordionTrigger className="text-lg flex gap-2 items-center">
                   <Globe className="w-5 h-5 text-primary" /> What languages do you support?
                </AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  Our AI understands over 50 languages, including Spanish, French, Mandarin, and German. You can upload a document in one language and ask questions in another!
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-7">
                <AccordionTrigger className="text-lg flex gap-2 items-center">
                   <Download className="w-5 h-5 text-primary" /> Can I export my quizzes?
                </AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  Yes. You can export any generated quiz or flashcard set as a PDF or text file to print out or use in other apps.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 relative overflow-hidden">
          {/* Solid BG with Gradient Bleed Overlay */}
          <div className="absolute inset-0 bg-background" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent z-0" />
          
          <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
            <h2 className="text-4xl md:text-6xl font-bold mb-8 tracking-tight">
              Ready to upgrade your grades?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
              Join thousands of students using AI to study smarter, not harder.
            </p>
            <div className="flex flex-col items-center justify-center gap-4">
              <Button
                size="lg"
                className="h-14 px-10 rounded-full text-xl shadow-2xl hover:scale-105 transition-transform"
                asChild
              >
                <Link href="/signup">
                  Get Started Now <ArrowRight className="ml-2 h-6 w-6" />
                </Link>
              </Button>
              <p className="text-sm font-medium text-muted-foreground mt-2">
                No credit card required. Generate your first quiz in 30 seconds.
              </p>
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