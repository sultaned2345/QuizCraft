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
  Check,
  Mic,
  Youtube,
  Link as LinkIcon,
  CalendarDays,
  Zap,
} from "lucide-react";

// --- Sub-Components ---

function FeatureCard({
  icon,
  title,
  description,
  colorClass = "text-primary",
  bgClass = "bg-primary/10",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  colorClass?: string;
  bgClass?: string;
}) {
  return (
    <Card className="border-none shadow-sm bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out rounded-3xl overflow-hidden group">
      <CardHeader>
        <div className={`w-14 h-14 rounded-2xl ${bgClass} flex items-center justify-center ${colorClass} mb-4 group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <CardTitle className="text-xl font-bold text-foreground">{title}</CardTitle>
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
    <div className="flex flex-col items-center text-center p-8 rounded-3xl bg-card border border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-primary shadow-inner">
          {icon}
        </div>
        <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm border-4 border-card shadow-sm">
          {number}
        </div>
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground max-w-xs mx-auto leading-relaxed">{description}</p>
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
    <Card className="h-full flex flex-col bg-card border-none shadow-md rounded-3xl relative">
      <div className="absolute -top-3 left-8 text-6xl text-primary/20 font-serif leading-none">“</div>
      <CardContent className="pt-8 flex-1">
        <blockquote className="text-lg leading-relaxed text-foreground/80 font-medium">
          {quote}
        </blockquote>
      </CardContent>
      <CardFooter className="bg-muted/30 py-4 mt-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold">
            {name.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-sm">{name}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

// --- Pricing Section ---
function PricingSection() {
  const plans = [
    {
      title: 'Monthly',
      price: '$9.99',
      period: '/mo',
      description: 'Flexible learning for short-term goals.',
      features: ['Unlimited Quizzes', 'Unlimited Documents', 'AI Chat & Summaries', 'Basic Support'],
      buttonVariant: 'outline' as const,
    },
    {
      title: 'Quarterly',
      price: '$19.99',
      period: '/qtr',
      description: 'Perfect for a single semester.',
      badge: 'Most Popular',
      subPrice: 'Just $6.66/mo',
      features: ['Everything in Monthly', 'Priority Support', 'AI Essay Grader', 'Early Access Features'],
      buttonVariant: 'default' as const,
      highlight: true,
    },
    {
      title: 'Yearly',
      price: '$49.99',
      period: '/yr',
      description: 'Best value for serious students.',
      badge: 'Best Value',
      subPrice: 'Just $4.17/mo',
      features: ['Everything in Quarterly', '2 Months Free', 'Dedicated Study Plan', 'Export to Anki/PDF'],
      buttonVariant: 'outline' as const,
    },
  ];

  return (
    <section className="py-32 bg-background" id="pricing">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-20">
          <Badge variant="secondary" className="mb-4 px-4 py-1 rounded-full text-primary bg-primary/10 hover:bg-primary/20">
            Transparent Pricing
          </Badge>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight">Invest in your brain</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Less than the price of a lunch, for better grades forever.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
          {plans.map((plan) => (
            <Card 
              key={plan.title} 
              className={`relative flex flex-col h-full transition-all duration-300 rounded-[2rem] overflow-visible ${
                plan.highlight 
                  ? 'border-2 border-primary shadow-2xl scale-105 z-10 bg-card' 
                  : 'border border-border/50 hover:shadow-xl bg-card/50'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-5 left-0 right-0 flex justify-center">
                  <Badge className={`${plan.highlight ? 'bg-gradient-to-r from-orange-500 to-amber-500' : 'bg-green-600'} text-white px-6 py-1.5 rounded-full text-sm shadow-md`}>
                    {plan.badge}
                  </Badge>
                </div>
              )}
              
              <CardHeader className={`${plan.highlight ? 'pt-10' : 'pt-8'}`}>
                <CardTitle className="text-xl text-muted-foreground font-medium">{plan.title}</CardTitle>
                <div className="mt-4 flex items-baseline text-foreground">
                  <span className="text-5xl font-extrabold tracking-tight">{plan.price}</span>
                  <span className="ml-1 text-base font-semibold text-muted-foreground">{plan.period}</span>
                </div>
                {plan.subPrice && (
                  <div className="inline-block mt-2 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-bold">
                    {plan.subPrice}
                  </div>
                )}
                <p className="text-base text-muted-foreground mt-4">{plan.description}</p>
              </CardHeader>
              
              <CardContent className="flex-1">
                <ul className="space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className="mt-0.5 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter className="pb-8">
                <Button className="w-full h-12 text-base rounded-2xl shadow-sm" size="lg" variant={plan.buttonVariant} asChild>
                   <Link href="/signup">Get Started</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Main Page Component ---

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen font-sans bg-background selection:bg-primary/20">
      <LandingHeader /> 

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-24 md:py-36 overflow-hidden">
          {/* Friendly Background Blobs */}
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-orange-200/20 rounded-full blur-[100px] -z-10 animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-200/20 rounded-full blur-[120px] -z-10" />
          
          <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
            <div className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-sm font-semibold text-orange-700 mb-8 shadow-sm backdrop-blur-sm dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300">
              <Sparkles className="mr-2 h-4 w-4 fill-orange-500 text-orange-600" />
              <span>New: AI Lecture Analysis is here!</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground mb-8 max-w-5xl mx-auto leading-[1.1]">
              Your Friendly <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500">AI Tutor</span> & <br className="hidden sm:block" /> Study Buddy
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
              Turn any document, video, or lecture into fun quizzes, flashcards, and summaries. Ace your exams without the stress.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Button size="lg" className="h-14 px-10 text-lg rounded-full shadow-xl shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-1 transition-all bg-gradient-to-r from-orange-600 to-amber-600 border-none" asChild>
                <Link href="/signup">
                  Start Studying Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-10 text-lg rounded-full border-2 hover:bg-accent/50" asChild>
                <Link href="/login">
                  Log In
                </Link>
              </Button>
            </div>
            
            {/* Social Proof / Trust Indicators */}
            <div className="mt-16 pt-8 border-t border-border/40 max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
               {/* Placeholders for logos (optional) */}
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-32 bg-muted/40 relative">
           {/* Decorative Curve */}
           <div className="absolute top-0 left-0 w-full overflow-hidden leading-[0]">
             <svg className="relative block w-[calc(100%+1.3px)] h-[50px] text-background" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                 <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="currentColor"></path>
             </svg>
           </div>

          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-extrabold mb-6">Everything you need to master it</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                QuizCraft transforms boring study materials into an active learning playground.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
              <FeatureCard
                icon={<MessageSquare className="w-7 h-7" />}
                title="Chat with Data"
                description="Upload PDFs or docs and just ask. It's like texting your textbook and getting instant, cited answers."
                colorClass="text-blue-600"
                bgClass="bg-blue-100 dark:bg-blue-900/30"
              />
              <FeatureCard
                icon={<FileQuestion className="w-7 h-7" />}
                title="Magic Quizzes"
                description="Instant multiple-choice, true/false, and fill-in-the-blank tests. We even explain why you got it wrong."
                colorClass="text-purple-600"
                bgClass="bg-purple-100 dark:bg-purple-900/30"
              />
              <FeatureCard
                icon={<Layers className="w-7 h-7" />}
                title="Smart Flashcards"
                description="Flashcards that track your memory. We show you the cards you struggle with just before you forget them."
                colorClass="text-green-600"
                bgClass="bg-green-100 dark:bg-green-900/30"
              />
              <FeatureCard
                icon={<Mic className="w-7 h-7" />}
                title="Audio Notes"
                description="Record a lecture or upload a file. We transcribe it, summarize it, and turn it into study fuel."
                colorClass="text-rose-600"
                bgClass="bg-rose-100 dark:bg-rose-900/30"
              />
              <FeatureCard
                icon={<Youtube className="w-7 h-7" />}
                title="YouTube Learning"
                description="Paste a video link. We watch it for you and generate a summary and quiz in seconds."
                colorClass="text-red-600"
                bgClass="bg-red-100 dark:bg-red-900/30"
              />
              <FeatureCard
                icon={<PenTool className="w-7 h-7" />}
                title="Essay Grader"
                description="Get instant scoring and feedback. Improve your writing style, grammar, and arguments instantly."
                colorClass="text-amber-600"
                bgClass="bg-amber-100 dark:bg-amber-900/30"
              />
            </div>
          </div>
        </section>

        {/* How It Works - "The Friendly Path" */}
        <section className="py-32 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-extrabold mb-6">Three steps to brilliance</h2>
              <p className="text-xl text-muted-foreground">No complex setup. Just upload and learn.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-5xl mx-auto relative">
              {/* Connecting dashed line for desktop */}
              <div className="hidden md:block absolute top-14 left-[16%] right-[16%] h-1 border-t-4 border-dashed border-muted -z-10" />
              
              <StepCard 
                number="1"
                title="Drop it in"
                description="Drag & drop your PDFs, recordings, or links. We handle the rest."
                icon={<Upload className="w-8 h-8" />}
              />
              <StepCard 
                number="2"
                title="Watch magic happen"
                description="Our AI breaks it down into bite-sized concepts and quizzes."
                icon={<Zap className="w-8 h-8" />}
              />
              <StepCard 
                number="3"
                title="Master it"
                description="Test yourself, track progress, and crush that exam."
                icon={<GraduationCap className="w-8 h-8" />}
              />
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-32 bg-orange-50/50 dark:bg-background border-t border-orange-100 dark:border-border/30">
          <div className="container mx-auto px-4 md:px-6">
             <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Students love the Fox 🦊</h2>
              <p className="text-lg text-muted-foreground">
                Join the community of smarter learners.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
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

        {/* Pricing */}
        <PricingSection />

        {/* CTA */}
        <section className="py-24 bg-gradient-to-br from-primary via-orange-600 to-amber-600 text-white rounded-t-[3rem] mt-12 mx-4 md:mx-8 shadow-[0_-10px_40px_-15px_rgba(234,88,12,0.3)]">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <h2 className="text-3xl md:text-5xl font-extrabold mb-6 tracking-tight">
              Ready to boost your grades?
            </h2>
            <p className="text-lg md:text-xl text-orange-100 max-w-2xl mx-auto mb-10 font-medium">
              Join thousands of students using AI to study smarter, not harder. 
              Get started today for free.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
               <Button size="lg" variant="secondary" className="h-14 px-10 rounded-full text-lg font-bold shadow-lg text-primary hover:bg-white" asChild>
                <Link href="/signup">
                  Get Started Now <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
               </Button>
            </div>
            <p className="mt-8 text-sm text-orange-200 flex items-center justify-center gap-6 font-medium">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> No credit card required</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Free plan available</span>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}