// src/app/page.tsx
import Link from "next/link";
import { LandingHeader } from "@/components/LandingHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  BarChart3,
  Youtube,
  FileType,
  XCircle,
  Check,
  RotateCw
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
    <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-primary/5 border border-primary/10 backdrop-blur-sm transition-transform hover:scale-105 cursor-default">
      <span className="text-2xl font-bold text-primary">{value}</span>
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
    </div>
  );
}

function PricingCard({ 
  title, 
  price, 
  features, 
  recommended = false,
  buttonText = "Get Started",
  href = "/signup"
}: { 
  title: string; 
  price: string; 
  features: string[]; 
  recommended?: boolean;
  buttonText?: string;
  href?: string;
}) {
  return (
    <Card className={`flex flex-col h-full relative ${recommended ? 'border-primary shadow-lg shadow-primary/20 scale-105 z-10' : 'border-muted'}`}>
      {recommended && (
        <div className="absolute -top-4 left-0 right-0 flex justify-center">
          <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs uppercase tracking-wide">
            Most Popular
          </Badge>
        </div>
      )}
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
        <div className="mt-4 flex items-baseline justify-center gap-1">
          <span className="text-4xl font-extrabold">{price}</span>
          {price !== "Free" && <span className="text-muted-foreground">/mo</span>}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-4">
        <ul className="space-y-3">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
              <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="pt-4">
        <Button className={`w-full rounded-full ${recommended ? '' : 'variant-outline'}`} variant={recommended ? 'default' : 'outline'} asChild>
          <Link href={href}>{buttonText}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

// --- Main Page ---

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen font-sans overflow-x-hidden selection:bg-primary/20">
      <LandingHeader />

      <main className="flex-1">
        
        {/* HERO SECTION */}
        <section className="relative pt-20 pb-32 md:pt-32 md:pb-48 overflow-hidden">
          {/* Static Gradient Background */}
          <div className="absolute top-0 left-0 right-0 h-[80vh] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background -z-20" />
          
          {/* Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)] -z-10 opacity-20" />

          <div className="container mx-auto px-4 md:px-6 text-center z-10 relative">
            
            {/* Badge */}
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-background/50 px-4 py-1.5 text-sm font-medium text-primary mb-8 animate-fade-in-up">
              <Sparkles className="mr-2 h-3.5 w-3.5 fill-primary" />
              <span>Now with AI Essay Grading</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-foreground mb-8 max-w-5xl mx-auto leading-[1.1] animate-fade-in-up delay-100">
              Turn <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">Anything</span> into <br />
              <span className="text-foreground">Mastery.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up delay-200">
              Stop passively reading. Upload PDFs, YouTube videos, or notes and let AI create instant quizzes and flashcards.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
              <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:scale-105 transition-all" asChild>
                <Link href="/signup">
                  Start Studying for Free <ArrowRight className="ml-2 h-5 w-5" />
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
              <StatBadge value="4.9/5" label="Rating" />
            </div>
          </div>
        </section>

        {/* INPUT SOURCES SECTION - NEW */}
        <section className="py-12 bg-muted/30 border-y border-primary/5">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-8">Works with your study materials</p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
              <div className="flex flex-col items-center gap-2 group">
                <div className="p-4 bg-background rounded-2xl shadow-sm border border-muted group-hover:border-red-200 group-hover:text-red-500 transition-colors">
                  <FileType className="w-8 h-8" />
                </div>
                <span className="text-xs font-medium">PDFs</span>
              </div>
              <div className="flex flex-col items-center gap-2 group">
                <div className="p-4 bg-background rounded-2xl shadow-sm border border-muted group-hover:border-blue-200 group-hover:text-blue-500 transition-colors">
                  <FileText className="w-8 h-8" />
                </div>
                <span className="text-xs font-medium">Word Docs</span>
              </div>
              <div className="flex flex-col items-center gap-2 group">
                <div className="p-4 bg-background rounded-2xl shadow-sm border border-muted group-hover:border-red-200 group-hover:text-red-600 transition-colors">
                  <Youtube className="w-8 h-8" />
                </div>
                <span className="text-xs font-medium">YouTube</span>
              </div>
              <div className="flex flex-col items-center gap-2 group">
                <div className="p-4 bg-background rounded-2xl shadow-sm border border-muted group-hover:border-green-200 group-hover:text-green-600 transition-colors">
                  <Brain className="w-8 h-8" />
                </div>
                <span className="text-xs font-medium">Notes</span>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES GRID */}
        <section className="py-24 bg-background relative">
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
                description="Receive instant feedback, grading, and improvement tips for your essays before you submit."
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

        {/* COMPARISON & DEMO SECTION - NEW */}
        <section className="py-24 bg-muted/30">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              
              {/* Left: The Argument */}
              <div>
                <h2 className="text-3xl md:text-5xl font-bold mb-6">Active Recall <br/> vs. Passive Reading</h2>
                <div className="space-y-6">
                  <div className="flex gap-4 p-4 rounded-xl bg-background/50 border border-muted opacity-60">
                    <XCircle className="w-6 h-6 text-red-400 shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-lg text-muted-foreground">The Old Way</h3>
                      <p className="text-muted-foreground">Re-reading notes and highlighting textbooks. Low retention, high time cost.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 rounded-xl bg-background border border-primary/20 shadow-sm">
                    <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-lg text-foreground">The QuizCraft Way</h3>
                      <p className="text-muted-foreground">Self-testing with AI-generated questions immediately after studying. Proven to boost grades.</p>
                    </div>
                  </div>
                </div>
                <div className="mt-8">
                  <Button variant="link" className="text-primary p-0 h-auto font-semibold">
                    Learn about our AI Methodology <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Right: Interactive Flip Card Demo (CSS Only) */}
              <div className="relative h-[300px] w-full perspective-1000 group cursor-pointer">
                {/* Instruction tooltip */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  Click or Hover to Flip
                </div>

                <div className="relative w-full h-full duration-500 preserve-3d group-hover:rotate-y-180">
                  {/* Front */}
                  <div className="absolute inset-0 backface-hidden rounded-2xl shadow-xl bg-gradient-to-br from-primary to-purple-600 text-white p-8 flex flex-col items-center justify-center text-center">
                    <Brain className="w-12 h-12 mb-4 opacity-80" />
                    <span className="text-sm font-medium opacity-70 uppercase tracking-widest mb-2">Question</span>
                    <h3 className="text-2xl font-bold">What is the "Spacing Effect" in psychology?</h3>
                    <RotateCw className="w-6 h-6 mt-6 opacity-50 animate-pulse" />
                  </div>

                  {/* Back */}
                  <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl shadow-xl bg-background border border-primary/20 p-8 flex flex-col items-center justify-center text-center">
                    <span className="text-sm font-medium text-primary uppercase tracking-widest mb-2">Answer</span>
                    <p className="text-lg text-foreground leading-relaxed">
                      It is the phenomenon where learning is greater when studying is spread out over time, as opposed to studying the same amount of content in a single session.
                    </p>
                    <div className="flex gap-2 mt-6">
                      <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600 hover:bg-red-50">Hard</Button>
                      <Button size="sm" variant="outline" className="text-green-500 hover:text-green-600 hover:bg-green-50">Easy</Button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* PRICING SECTION - NEW */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
              <p className="text-lg text-muted-foreground">Invest in your education for less than the cost of a coffee.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
              <PricingCard 
                title="Free Starter"
                price="Free"
                features={[
                  "3 Document Uploads / mo",
                  "Basic Quiz Generation",
                  "Limited AI Chat",
                  "Export to PDF"
                ]}
              />
              <PricingCard 
                title="Pro Student"
                price="$9.99"
                features={[
                  "Unlimited Uploads",
                  "Unlimited Quizzes",
                  "Advanced Essay Grading",
                  "Priority AI Processing",
                  "YouTube Summaries"
                ]}
                recommended={true}
                buttonText="Start Free Trial"
              />
              <PricingCard 
                title="Lifetime"
                price="$199"
                features={[
                  "One-time payment",
                  "All Pro features forever",
                  "Early access to new features",
                  "Priority Support",
                  "API Access"
                ]}
              />
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
                 <AccordionContent>Yes! Free forever for up to 3 documents a month. No credit card required to start.</AccordionContent>
               </AccordionItem>
               <AccordionItem value="item-2">
                 <AccordionTrigger className="text-lg">Can I trust the AI?</AccordionTrigger>
                 <AccordionContent>We always cite the page number so you can verify facts instantly. However, we always recommend reviewing materials before a major exam.</AccordionContent>
               </AccordionItem>
               <AccordionItem value="item-3">
                 <AccordionTrigger className="text-lg">Does it work on mobile?</AccordionTrigger>
                 <AccordionContent>Absolutely. QuizCraft is fully responsive. You can study your flashcards on the bus, in bed, or between classes.</AccordionContent>
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