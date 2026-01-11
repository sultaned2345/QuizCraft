// src/app/(app)/dashboard/page.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Zap, 
  BrainCircuit, 
  Flame, 
  TrendingUp, 
  Clock, 
  Plus, 
  ArrowRight,
  BookOpen,
  Trophy,
  Target
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  const { session } = useAuth();
  // Get first name or default to 'Scholar'
  const userName = session?.user?.user_metadata?.full_name?.split(' ')[0] || 'Scholar';

  // Mock Data - In the future, fetch this from your API
  const stats = {
    streak: 12,
    quizzesMastered: 8,
    studyHours: 4.5,
    xp: 2450
  };

  const recentDocs = [
    { title: 'Introduction to Neuroscience', type: 'PDF', date: '2h ago', progress: 45 },
    { title: 'Advanced React Patterns', type: 'Video', date: '5h ago', progress: 90 },
    { title: 'History of the Roman Empire', type: 'PDF', date: '1d ago', progress: 10 },
  ];

  return (
    <div className="min-h-full space-y-8 pb-10 animate-in fade-in duration-700">
      
      {/* 1. Hero Section */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Good afternoon, {userName}
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Ready to supercharge your learning today?
          </p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
           <Button variant="outline" className="gap-2 border-dashed border-yellow-500/50 hover:bg-yellow-500/10 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors">
             <Zap className="w-4 h-4 text-yellow-500" /> Daily Goal: 80%
           </Button>
           <Link href="/documents">
             <Button className="gap-2 shadow-lg shadow-primary/20 w-full md:w-auto">
               <Plus className="w-4 h-4" /> Quick Upload
             </Button>
           </Link>
        </div>
      </div>

      {/* 2. Stats Overview (Glassmorphism Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard 
          icon={Flame} 
          value={stats.streak.toString()} 
          label="Day Streak" 
          color="text-orange-500" 
          bg="bg-orange-500/10" 
          border="border-orange-500/20"
        />
        <StatsCard 
          icon={Trophy} 
          value={stats.quizzesMastered.toString()} 
          label="Quizzes Aced" 
          color="text-yellow-500" 
          bg="bg-yellow-500/10" 
          border="border-yellow-500/20"
        />
        <StatsCard 
          icon={Clock} 
          value={`${stats.studyHours}h`} 
          label="Focus Time" 
          color="text-blue-500" 
          bg="bg-blue-500/10" 
          border="border-blue-500/20"
        />
        <StatsCard 
          icon={TrendingUp} 
          value={`${stats.xp}`} 
          label="Total XP" 
          color="text-emerald-500" 
          bg="bg-emerald-500/10" 
          border="border-emerald-500/20"
        />
      </div>

      {/* 3. Main Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Column: Recent Activity (Span 7) */}
        <div className="md:col-span-7 space-y-6">
          <Card className="p-6 h-full border-border/60 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-primary" />
                Jump Back In
              </h3>
              <Link href="/documents" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 group">
                View All <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="space-y-4">
              {recentDocs.map((doc, i) => (
                <div key={i} className="group flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50 cursor-pointer">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate text-sm md:text-base group-hover:text-primary transition-colors">{doc.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold">{doc.type}</span>
                      <span>•</span>
                      <span>{doc.date}</span>
                    </div>
                  </div>
                  <div className="w-24 hidden sm:block">
                    <div className="flex justify-between text-[10px] mb-1 font-medium text-muted-foreground">
                      <span>Progress</span>
                      <span>{doc.progress}%</span>
                    </div>
                    <Progress value={doc.progress} className="h-1.5" />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t border-border/50">
               <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground text-sm">
                 Show older activity
               </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: AI Insights & Quick Actions (Span 5) */}
        <div className="md:col-span-5 flex flex-col gap-6">
          
          {/* Quick Actions Tile */}
          <Card className="p-6 border-border/60 bg-gradient-to-br from-primary/5 to-transparent shadow-sm">
             <h3 className="font-semibold mb-4 flex items-center gap-2">
               <Target className="w-4 h-4 text-primary" />
               Create New
             </h3>
             <div className="grid grid-cols-2 gap-3">
               <ActionButton icon={Plus} label="Upload" href="/documents" />
               <ActionButton icon={Zap} label="Flashcards" href="/flashcards" />
               <ActionButton icon={BrainCircuit} label="Quiz" href="/quizzes" />
               <ActionButton icon={TrendingUp} label="Plan" href="/projects" />
             </div>
          </Card>

          {/* AI Insight Tile */}
          <Card className="flex-1 p-6 border-border/60 bg-card/50 shadow-sm relative overflow-hidden group">
             {/* Decorative Background Icon */}
             <div className="absolute top-[-10px] right-[-10px] p-3 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
               <BrainCircuit className="w-32 h-32 rotate-12" />
             </div>
             
             <h3 className="font-semibold mb-3 flex items-center gap-2">
               <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500 animate-pulse" />
               Smart Insight
             </h3>
             <p className="text-sm text-muted-foreground leading-relaxed">
               Based on your recent quiz scores, you seem to be struggling with <span className="font-medium text-foreground">"Neural Networks"</span>. 
               We recommend a quick review session before moving to Deep Learning.
             </p>
             <Button size="sm" className="mt-5 w-full bg-background hover:bg-muted text-foreground border border-border shadow-sm transition-all hover:translate-y-[-1px]">
               Start Review Session
             </Button>
          </Card>

        </div>
      </div>
    </div>
  );
}

// --- Helper Components ---

function StatsCard({ icon: Icon, value, label, color, bg, border }: any) {
  return (
    <Card className={`p-4 border shadow-sm hover:shadow-md transition-all ${border} bg-card/50 backdrop-blur-sm`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground font-medium mt-1">{label}</p>
        </div>
        <div className={`p-2.5 rounded-xl ${bg}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
    </Card>
  );
}

function ActionButton({ icon: Icon, label, href }: { icon: any, label: string, href: string }) {
  return (
    <Link href={href} className="w-full">
      <button className="w-full flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-background border border-border/50 hover:border-primary/50 hover:bg-muted/50 transition-all text-sm font-medium text-muted-foreground hover:text-foreground group">
        <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        {label}
      </button>
    </Link>
  );
}