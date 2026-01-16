// src/app/(app)/dashboard/page.tsx
'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { 
  BookOpen, 
  BrainCircuit, 
  FileText, 
  LayoutDashboard, 
  PenTool, 
  Plus, 
  Sparkles, 
  StickyNote,
  Clock,
  ArrowRight,
  GraduationCap
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddDocumentDialog } from '@/components/AddDocumentDialog'; 
import { Skeleton } from '@/components/ui/skeleton';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// --- Helper for Quick Action Tiles ---
function ActionTile({ 
  icon, 
  title, 
  colorClass, 
  bgClass, 
  href,
  onClick
}: { 
  icon: React.ReactNode, 
  title: string, 
  colorClass: string, 
  bgClass: string, 
  href?: string,
  onClick?: () => void
}) {
  const content = (
    <div className={`flex flex-col items-center justify-center p-6 rounded-3xl transition-all duration-300 hover:scale-105 hover:shadow-lg cursor-pointer border-2 border-transparent hover:border-${colorClass.split('-')[1]}-200 h-full ${bgClass}`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-white/60 dark:bg-black/20 backdrop-blur-sm ${colorClass}`}>
        {icon}
      </div>
      <span className="font-bold text-foreground/90">{title}</span>
    </div>
  );

  if (href) return <Link href={href} className="block h-full">{content}</Link>;
  return <div onClick={onClick} className="h-full">{content}</div>;
}

export default function DashboardPage() {
  const { data, isLoading, mutate } = useSWR('/api/library', fetcher);
  
  const allContent = data?.data || [];
  
  // Stats
  const stats = {
    documents: allContent.filter((i: any) => i.type === 'document').length,
    quizzes: allContent.filter((i: any) => i.type === 'quiz').length,
    notes: allContent.filter((i: any) => i.type === 'note').length,
  };

  // Recents (Top 4 now, for grid balance)
  const recentItems = [...allContent]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

  const getIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText className="w-5 h-5 text-blue-500" />;
      case 'note': return <StickyNote className="w-5 h-5 text-yellow-500" />;
      case 'quiz': return <BrainCircuit className="w-5 h-5 text-purple-500" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getUrl = (item: any) => {
    switch (item.type) {
      case 'document': return `/documents/${item.id}`;
      case 'note': return `/notes/${item.id}`;
      case 'quiz': return `/quiz/${item.id}`;
      case 'deck': return `/flashcards/${item.id}`;
      default: return '#';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-8 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
            <Skeleton className="h-12 w-64 rounded-xl" />
            <Skeleton className="h-12 w-40 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-3xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-3xl mt-8" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-10 max-w-7xl animate-in fade-in duration-500 font-sans">
      
      {/* 1. Friendly Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-3 text-foreground">
            <span role="img" aria-label="wave">👋</span> Welcome back!
          </h1>
          <p className="text-lg text-muted-foreground mt-2 font-medium">
            Your brain is ready for an upgrade. What are we learning today?
          </p>
        </div>
        
        {/* Big Pill Button */}
        <AddDocumentDialog onUploadSuccess={() => mutate()}>
            <Button size="lg" className="h-12 px-8 rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:-translate-y-0.5 text-base font-bold bg-gradient-to-r from-primary to-orange-600 border-none">
                <Plus className="w-5 h-5 mr-2" /> Create New Set
            </Button>
        </AddDocumentDialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 2. Left Column: Colorful Quick Action Tiles (The "Playground") */}
        <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> 
                Quick Actions
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                 <AddDocumentDialog onUploadSuccess={() => mutate()}>
                     {/* Wrapper div to capture click since DialogTrigger wraps children */}
                     <div className="h-36">
                        <ActionTile 
                            icon={<FileText className="w-6 h-6" />}
                            title="Upload Doc"
                            colorClass="text-blue-600"
                            bgClass="bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20"
                        />
                     </div>
                 </AddDocumentDialog>

                 <div className="h-36">
                    <ActionTile 
                        href="/create"
                        icon={<BrainCircuit className="w-6 h-6" />}
                        title="Generate Quiz"
                        colorClass="text-purple-600"
                        bgClass="bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20"
                    />
                 </div>

                 <div className="h-36">
                    <ActionTile 
                        href="/notes/new"
                        icon={<PenTool className="w-6 h-6" />}
                        title="Write Notes"
                        colorClass="text-pink-600"
                        bgClass="bg-pink-50 hover:bg-pink-100 dark:bg-pink-900/20"
                    />
                 </div>
            </div>

            {/* Recent Activity List - Soft & Clean */}
            <div className="pt-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    Jump Back In
                    </h2>
                    <Link href="/documents" className="text-sm font-semibold text-primary hover:underline flex items-center">
                        View Library <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recentItems.length === 0 ? (
                    <div className="col-span-full p-12 text-center border-2 border-dashed border-muted rounded-3xl bg-muted/10">
                        <div className="w-16 h-16 bg-muted rounded-full mx-auto flex items-center justify-center mb-4">
                            <BookOpen className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-lg font-medium text-muted-foreground">It's quiet in here...</p>
                        <p className="text-sm text-muted-foreground">Create your first study set above!</p>
                    </div>
                    ) : (
                    recentItems.map((item: any) => (
                        <Link key={item.id} href={getUrl(item)}>
                        <div className="group flex items-center gap-4 p-4 rounded-3xl border border-border/40 bg-card hover:border-primary/30 hover:shadow-md hover:bg-accent/30 transition-all duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-muted/50 group-hover:bg-white group-hover:shadow-sm flex items-center justify-center transition-all">
                                {getIcon(item.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold truncate text-foreground group-hover:text-primary transition-colors">{item.title}</h4>
                                <p className="text-xs font-medium text-muted-foreground capitalize mt-1">
                                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                </p>
                            </div>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-transparent group-hover:bg-primary/10 transition-colors">
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                            </div>
                        </div>
                        </Link>
                    ))
                    )}
                </div>
            </div>
        </div>

        {/* 3. Right Column: Stats Card (Vertical Stack) */}
        <div className="space-y-6">
            <Card className="border-none shadow-lg bg-gradient-to-b from-orange-50 to-white dark:from-card dark:to-background rounded-[2rem] overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <GraduationCap className="w-5 h-5 text-primary" /> 
                        Your Progress
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-card border border-border/50 rounded-2xl shadow-sm">
                        <span className="text-muted-foreground font-medium">Documents</span>
                        <span className="text-2xl font-bold text-blue-600">{stats.documents}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-card border border-border/50 rounded-2xl shadow-sm">
                        <span className="text-muted-foreground font-medium">Quizzes</span>
                        <span className="text-2xl font-bold text-purple-600">{stats.quizzes}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-card border border-border/50 rounded-2xl shadow-sm">
                        <span className="text-muted-foreground font-medium">Notes</span>
                        <span className="text-2xl font-bold text-amber-600">{stats.notes}</span>
                    </div>
                    
                    <div className="pt-4">
                        <div className="p-4 rounded-2xl bg-primary/10 border border-primary/10">
                            <h4 className="font-bold text-primary mb-1 text-sm">Study Streak 🔥</h4>
                            <p className="text-xs text-muted-foreground mb-3">You're on a roll! Keep it up.</p>
                            <div className="w-full bg-primary/20 h-2 rounded-full overflow-hidden">
                                <div className="bg-primary h-full w-[75%] rounded-full" />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

      </div>
    </div>
  );
}