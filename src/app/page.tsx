// src/app/page.tsx
import Link from "next/link";
import { LandingHeader } from "@/components/LandingHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Sparkles,
  Zap,
  Brain,
  FileText,
  Upload,
  GraduationCap,
  CheckCircle2,
  Share2,
  BarChart3
} from "lucide-react";

// --- Lightweight Components ---

function FeatureCard({
  icon,
  title,
  description,
  delay
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: string;
}) {
  return (
    <div 
      className={`group relative overflow-hidden rounded-2xl border border-primary/10 bg-card/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/20 ${delay}`}
    >
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
        {icon}
      </div>
      
      <h3 className="mb-2 text-xl font-bold tracking-tight text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-primary/5 border border-primary/10 backdrop-blur-sm">
      <span className="text-2xl font-bold text-primary">{value}</span>
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
    </div>
  );
}

// --- Main Page ---

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen font-sans overflow-x-hidden selection:bg-primary/20">
      <LandingHeader />

      <main className="flex-1">
        
        {/* HERO SECTION: Optimized with CSS Gradients (No heavy blurs) */}
        <section className="relative pt-20 pb-32 md:pt-32 md:pb-48 overflow-hidden">
          {/* Static Gradient Background - Zero Lag */}
          <div className="absolute top-0 left-0 right-0 h-[80vh] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background -z-20" />
          
          {/* Grid Pattern - CSS Only */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)] -z-10 opacity-20" />

          <div className="container mx-auto px-4 md:px-6 text-center z-10 relative">
            
            {/* Badge */}
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-background/50 px-4 py-1.5 text-sm font-medium text-primary mb-8 animate-fade-in-up">
              <Sparkles className="mr-2 h-3.5 w-3.5 fill-primary" />
              <span>AI-Powered Study Assistant</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-foreground mb-8 max-w-5xl mx-auto leading-[1.1] animate-fade-in-up delay-100">
              Turn <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">Notes</span> into <br />
              <span className="text-foreground">Mastery.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up delay-200">
              Upload documents, get instant quizzes, flashcards, and summaries. 
              The smartest way to study is here.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
              <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:scale-105 transition-all" asChild>
                <Link href="/signup">
                  Get Started for Free <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full hover:bg-muted/50 transition-all" asChild>
                <Link href="/login">Log In</Link>
              </Button>
            </div>

            {/* Social Proof Stats */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto animate-fade-in-up delay-500">
              <StatBadge value="10k+" label="Students" />
              <StatBadge value="500k+" label="Quizzes" />
              <StatBadge value="50+" label="Languages" />
              <StatBadge value="24/7" label="AI Tutor" />
            </div>
          </div>
        </section>

        {/* FEATURES GRID: Replaced BentoGrid with Clean CSS Grid */}
        <section className="py-24 bg-muted/20 relative">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">Everything you need to ace it.</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                No complex setup. Just upload and learn.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard 
                icon={<Brain className="w-6 h-6" />}
                title="AI Quiz Generator"
                description="Turn any PDF, Doc, or text into a multiple-choice quiz in seconds. Test your knowledge instantly."
                delay="animate-fade-in-up delay-0"
              />
              <FeatureCard 
                icon={<Zap className="w-6 h-6" />}
                title="Smart Flashcards"
                description="Our AI identifies key terms and creates flashcard decks for spaced repetition learning."
                delay="animate-fade-in-up delay-100"
              />
              <FeatureCard 
                icon={<FileText className="w-6 h-6" />}
                title="Instant Summaries"
                description="Get concise, bulleted summaries of long documents. Grasp the core concepts faster."
                delay="animate-fade-in-up delay-200"
              />
              <FeatureCard 
                icon={<GraduationCap className="w-6 h-6" />}
                title="Essay Grader"
                description="Receive instant feedback, grading, and improvement tips for your essays."
                delay="animate-fade-in-up delay-300"
              />
               <FeatureCard 
                icon={<Share2 className="w-6 h-6" />}
                title="Share & Collaborate"
                description="Share your quizzes and decks with classmates. Study together in real-time."
                delay="animate-fade-in-up delay-400"
              />
               <FeatureCard 
                icon={<BarChart3 className="w-6 h-6" />}
                title="Progress Tracking"
                description="Visualize your improvement over time with detailed analytics and insights."
                delay="animate-fade-in-up delay-500"
              />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS: Simple Steps */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
              <div>
                <h2 className="text-3xl md:text-5xl font-bold mb-6">Study smarter, <br/><span className="text-primary">not harder.</span></h2>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  QuizCraft takes the manual labor out of studying. Stop highlighting endless pages and start actively testing your memory.
                </p>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">1</div>
                    <div>
                      <h3 className="font-bold text-lg">Upload your material</h3>
                      <p className="text-muted-foreground">PDFs, Word docs, PowerPoints, or just plain text.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">2</div>
                    <div>
                      <h3 className="font-bold text-lg">AI generates the plan</h3>
                      <p className="text-muted-foreground">We automatically create quizzes, flashcards, and notes.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">3</div>
                    <div>
                      <h3 className="font-bold text-lg">Master the subject</h3>
                      <p className="text-muted-foreground">Review with our interactive tools until you're 100% ready.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Decorative Visual - CSS Only (No heavy image) */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-purple-500/20 blur-3xl rounded-full -z-10" />
                <Card className="border-muted/40 shadow-2xl bg-card/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-primary" />
                      Generated Quiz
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                        <p className="font-medium mb-3">What is the powerhouse of the cell?</p>
                        <div className="space-y-2">
                          <div className="p-2 rounded border border-border bg-background text-sm text-muted-foreground">A. Nucleus</div>
                          <div className="p-2 rounded border border-primary bg-primary/10 text-sm font-medium text-primary flex justify-between items-center">
                            B. Mitochondria
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div className="p-2 rounded border border-border bg-background text-sm text-muted-foreground">C. Ribosome</div>
                        </div>
                     </div>
                     <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                       <div className="h-full w-[60%] bg-primary" />
                     </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24 bg-muted/20">
           <div className="container mx-auto px-4 md:px-6 max-w-3xl">
             <div className="text-center mb-12">
               <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
             </div>
             <Accordion type="single" collapsible className="w-full">
               <AccordionItem value="item-1">
                 <AccordionTrigger className="text-lg">Is QuizCraft free?</AccordionTrigger>
                 <AccordionContent>Yes! Free forever for up to 3 documents a month.</AccordionContent>
               </AccordionItem>
               <AccordionItem value="item-2">
                 <AccordionTrigger className="text-lg">Can I trust the AI?</AccordionTrigger>
                 <AccordionContent>We always cite the page number so you can verify facts instantly.</AccordionContent>
               </AccordionItem>
               <AccordionItem value="item-3">
                 <AccordionTrigger className="text-lg">Does it work on mobile?</AccordionTrigger>
                 <AccordionContent>Absolutely. QuizCraft is fully responsive and works great on phones.</AccordionContent>
               </AccordionItem>
             </Accordion>
           </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-primary/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent -z-10" />
          <div className="container mx-auto px-4 md:px-6 text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">
              Ready to <span className="text-primary">upgrade your grades?</span>
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
               <Button size="lg" className="h-14 px-10 rounded-full text-xl shadow-xl hover:scale-105 transition-transform" asChild>
                <Link href="/signup">Get Started Now <ArrowRight className="ml-2 h-6 w-6" /></Link>
               </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">No credit card required • Cancel anytime</p>
          </div>
        </section>

      </main>
    </div>
  );
}