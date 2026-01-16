import Link from "next/link";
import { LandingHeader } from "@/components/LandingHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Sparkles,
  MessageSquare,
  FileQuestion,
  Layers,
  PenTool,
  CheckCircle2,
  Upload,
  GraduationCap,
  Check,
  Mic,
  Youtube,
  Zap,
  BookOpen,
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
    <Card className="border border-border/60 shadow-sm bg-card hover:shadow-md hover:-translate-y-1 transition-all duration-300 ease-out rounded-2xl group overflow-hidden">
      <CardHeader>
        <div className={`w-14 h-14 rounded-2xl ${bgClass} flex items-center justify-center ${colorClass} mb-4 group-hover:scale-105 transition-transform duration-300`}>
          {icon}
        </div>
        <CardTitle className="text-xl font-serif font-medium text-foreground">{title}</CardTitle>
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
    <div className="flex flex-col items-center text-center p-8 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-secondary/30 flex items-center justify-center text-secondary-foreground shadow-sm">
          {icon}
        </div>
        <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-serif font-bold text-sm border-4 border-card">
          {number}
        </div>
      </div>
      <h3 className="text-xl font-serif font-medium mb-3 text-foreground">{title}</h3>
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
    <Card className="h-full flex flex-col bg-card border border-border/60 shadow-sm rounded-2xl relative">
      <div className="absolute top-6 left-6 text-6xl text-primary/10 font-serif leading-none">“</div>
      <CardContent className="pt-10 flex-1 relative z-10">
        <blockquote className="text-lg leading-relaxed text-foreground/80 font-serif italic">
          {quote}
        </blockquote>
      </CardContent>
      <CardFooter className="bg-muted/30 py-4 mt-4 border-t border-border/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-serif font-bold">
            {name.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-sm text-foreground">{name}</p>
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
    <section className="py-24 md:py-32 bg-background" id="pricing">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 px-4 py-1 rounded-full text-primary bg-primary/10 hover:bg-primary/20 border-none">
            Transparent Pricing
          </Badge>
          <h2 className="text-4xl md:text-5xl font-serif font-medium mb-6 tracking-tight text-foreground">Invest in your mind</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Less than the price of a lunch, for better grades forever.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
          {plans.map((plan) => (
            <Card 
              key={plan.title} 
              className={`relative flex flex-col h-full transition-all duration-300 rounded-2xl overflow-visible ${
                plan.highlight 
                  ? 'border-2 border-primary shadow-xl scale-105 z-10 bg-card' 
                  : 'border border-border/60 hover:shadow-lg bg-card/40'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm shadow-sm hover:bg-primary/90">
                    {plan.badge}
                  </Badge>
                </div>
              )}
              
              <CardHeader className={`${plan.highlight ? 'pt-10' : 'pt-8'}`}>
                <CardTitle className="text-xl text-muted-foreground font-serif font-medium">{plan.title}</CardTitle>
                <div className="mt-4 flex items-baseline text-foreground">
                  <span className="text-5xl font-serif font-medium tracking-tight">{plan.price}</span>
                  <span className="ml-1 text-base font-medium text-muted-foreground">{plan.period}</span>
                </div>
                {plan.subPrice && (
                  <div className="inline-block mt-2 px-3 py-1 rounded-full bg-secondary/30 text-secondary-foreground text-sm font-medium">
                    {plan.subPrice}
                  </div>
                )}
                <p className="text-base text-muted-foreground mt-4">{plan.description}</p>
              </CardHeader>
              
              <CardContent className="flex-1">
                <ul className="space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter className="pb-8">
                <Button className="w-full h-12 text-base rounded-xl shadow-sm" size="lg" variant={plan.buttonVariant} asChild>
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
          {/* Calm Background Blobs (Stone & Clay) */}
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -z-10 animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-secondary/20 rounded-full blur-[120px] -z-10" />
          
          <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-8 shadow-sm backdrop-blur-sm">
              <Sparkles className="mr-2 h-4 w-4" />
              <span>New: AI Lecture Analysis is here!</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-serif font-medium tracking-tight text-foreground mb-8 max-w-5xl mx-auto leading-[1.1]">
              Your Calm <span className="text-primary">AI Tutor</span> & <br className="hidden sm:block" /> Study Companion
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
              Turn any document, video, or lecture into stress-free quizzes, flashcards, and summaries. 
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Button size="lg" className="h-14 px-10 text-lg rounded-xl shadow-md bg-primary hover:bg-primary/90 text-primary-foreground transition-all" asChild>
                <Link href="/signup">
                  Start Studying Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-10 text-lg rounded-xl border-border/60 hover:bg-muted/50 text-foreground" asChild>
                <Link href="/login">
                  Log In
                </Link>
              </Button>
            </div>
            
            {/* Social Proof Placeholder */}
            <div className="mt-16 pt-8 border-t border-border/40 max-w-4xl mx-auto opacity-60">
               <p className="text-sm text-muted-foreground font-serif italic">Trusted by students worldwide</p>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-24 md:py-32 bg-secondary/10 relative">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-serif font-medium mb-6 text-foreground">Everything you need to master it</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                QuizCraft transforms chaotic notes into an organized learning sanctuary.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              <FeatureCard
                icon={<MessageSquare className="w-6 h-6" />}
                title="Chat with Data"
                description="Upload PDFs or docs and just ask. It's like texting your textbook and getting instant, cited answers."
                colorClass="text-primary"
                bgClass="bg-primary/10"
              />
              <FeatureCard
                icon={<FileQuestion className="w-6 h-6" />}
                title="Magic Quizzes"
                description="Instant multiple-choice, true/false, and fill-in-the-blank tests. We even explain why you got it wrong."
                colorClass="text-secondary-foreground"
                bgClass="bg-secondary/30"
              />
              <FeatureCard
                icon={<Layers className="w-6 h-6" />}
                title="Smart Flashcards"
                description="Flashcards that track your memory. We show you the cards you struggle with just before you forget them."
                colorClass="text-emerald-700"
                bgClass="bg-emerald-100 dark:bg-emerald-900/30"
              />
              <FeatureCard
                icon={<Mic className="w-6 h-6" />}
                title="Audio Notes"
                description="Record a lecture or upload a file. We transcribe it, summarize it, and turn it into study fuel."
                colorClass="text-rose-700"
                bgClass="bg-rose-100 dark:bg-rose-900/30"
              />
              <FeatureCard
                icon={<Youtube className="w-6 h-6" />}
                title="YouTube Learning"
                description="Paste a video link. We watch it for you and generate a summary and quiz in seconds."
                colorClass="text-red-700"
                bgClass="bg-red-100 dark:bg-red-900/30"
              />
              <FeatureCard
                icon={<PenTool className="w-6 h-6" />}
                title="Essay Grader"
                description="Get instant scoring and feedback. Improve your writing style, grammar, and arguments instantly."
                colorClass="text-amber-700"
                bgClass="bg-amber-100 dark:bg-amber-900/30"
              />
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 md:py-32 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-serif font-medium mb-6 text-foreground">Three steps to brilliance</h2>
              <p className="text-xl text-muted-foreground">No complex setup. Just upload and learn.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-5xl mx-auto relative">
              {/* Connecting dashed line for desktop */}
              <div className="hidden md:block absolute top-14 left-[16%] right-[16%] h-px border-t-2 border-dashed border-border/60 -z-10" />
              
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
        <section className="py-24 md:py-32 bg-muted/30 border-t border-border/40">
          <div className="container mx-auto px-4 md:px-6">
             <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-serif font-medium mb-4">Students love the focus</h2>
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
        <section className="py-24 bg-primary text-primary-foreground rounded-t-[2.5rem] mt-12 mx-4 md:mx-8 shadow-xl">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-foreground/10 mb-8">
                <BookOpen className="w-8 h-8" />
            </div>
            <h2 className="text-3xl md:text-5xl font-serif font-medium mb-6 tracking-tight">
              Ready to boost your grades?
            </h2>
            <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
              Join thousands of students using AI to study smarter, not harder. 
              Get started today for free.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
               <Button size="lg" variant="secondary" className="h-14 px-10 rounded-xl text-lg font-bold shadow-sm text-secondary-foreground hover:bg-secondary" asChild>
                <Link href="/signup">
                  Get Started Now <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
               </Button>
            </div>
            <p className="mt-8 text-sm text-primary-foreground/80 flex items-center justify-center gap-6 font-medium">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> No credit card required</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Free plan available</span>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}