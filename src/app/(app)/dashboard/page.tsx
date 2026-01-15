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
  ArrowRight
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AddDocumentDialog } from '@/components/AddDocumentDialog'; // ✅ EXCLUSIVE USAGE
import { Skeleton } from '@/components/ui/skeleton';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardPage() {
  const { data, isLoading, mutate } = useSWR('/api/library', fetcher);
  
  const allContent = data?.data || [];
  
  // 1. Stats
  const stats = {
    documents: allContent.filter((i: any) => i.type === 'document').length,
    quizzes: allContent.filter((i: any) => i.type === 'quiz').length,
    notes: allContent.filter((i: any) => i.type === 'note').length,
  };

  // 2. Recents (Top 3)
  const recentItems = [...allContent]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

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
        <Skeleton className="h-12 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-7xl animate-in fade-in duration-500">
      
      {/* 1. Header & Primary Action */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-8 h-8 text-primary" /> 
            Command Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your progress and start new learning sessions.
          </p>
        </div>
        
        {/* ✅ THE MAIN "CREATE" BUTTON */}
        <AddDocumentDialog onUploadSuccess={() => mutate()}>
            <Button size="lg" className="gap-2 shadow-lg shadow-primary/20">
                <Plus className="w-5 h-5" /> New Study Set
            </Button>
        </AddDocumentDialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 2. Left Column: Stats & Quick Actions */}
        <div className="space-y-6">
            {/* Quick Actions Card */}
            <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-transparent border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" /> 
                    Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                 <AddDocumentDialog onUploadSuccess={() => mutate()}>
                    <Button variant="secondary" className="w-full justify-start bg-background/50 hover:bg-background">
                        <FileText className="w-4 h-4 mr-2 text-blue-500" /> Upload Document
                    </Button>
                 </AddDocumentDialog>
                 <Button variant="secondary" className="w-full justify-start bg-background/50 hover:bg-background" asChild>
                    <Link href="/create">
                        <BrainCircuit className="w-4 h-4 mr-2 text-purple-500" /> Generate Quiz
                    </Link>
                 </Button>
                 <Button variant="secondary" className="w-full justify-start bg-background/50 hover:bg-background" asChild>
                    <Link href="/notes/new">
                        <PenTool className="w-4 h-4 mr-2 text-pink-500" /> Write Notes
                    </Link>
                 </Button>
              </CardContent>
            </Card>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 gap-4">
                <Card>
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <span className="text-3xl font-bold">{stats.documents}</span>
                        <span className="text-xs text-muted-foreground uppercase font-medium mt-1">Docs</span>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <span className="text-3xl font-bold">{stats.quizzes}</span>
                        <span className="text-xs text-muted-foreground uppercase font-medium mt-1">Quizzes</span>
                    </CardContent>
                </Card>
            </div>
        </div>

        {/* 3. Right Column: Recent Activity */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Jump Back In
            </h2>
            <Link href="/documents" className="text-sm text-primary hover:underline flex items-center">
                View Library <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="grid gap-3">
            {recentItems.length === 0 ? (
               <div className="p-12 text-center border rounded-xl bg-muted/20 border-dashed">
                 <p className="text-muted-foreground">No recent activity. Create a study set to get started!</p>
               </div>
            ) : (
              recentItems.map((item: any) => (
                <Link key={item.id} href={getUrl(item)}>
                  <div className="group flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:border-primary/50 hover:shadow-md transition-all">
                    <div className="p-3 rounded-lg bg-muted group-hover:bg-primary/5 transition-colors">
                      {getIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate group-hover:text-primary transition-colors">{item.title}</h4>
                      <p className="text-sm text-muted-foreground capitalize flex items-center gap-2">
                        {item.type} • <span className="text-xs">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}