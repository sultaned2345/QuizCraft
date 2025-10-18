'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseHelpers } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ArrowLeft, LogOut, Sparkles } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from '@/components/theme-toggle';

const DashboardHeader = () => {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="py-4 px-6 md:px-12 flex justify-between items-center bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <Link href="/" className="flex items-center gap-2">
        <Sparkles className="w-6 h-6 text-primary" />
        <span className="text-xl font-bold">QuizCraft</span>
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {user?.email}
        </span>
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </header>
  );
};


export default function EditQuizPage() {
  const { quizId } = useParams();
  const { session } = useAuth();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
        router.push('/login');
        return;
    }
    if (user && quizId) {
      supabaseHelpers.getQuiz(quizId as string)
        .then((quiz: any) => {
          if (quiz.user_id !== user.id) {
            toast({ title: "Access Denied", description: "You don't have permission to edit this quiz.", variant: "destructive" });
            router.push('/dashboard');
            return;
          }
          setTitle(quiz.title);
          setLoading(false);
        })
        .catch(() => {
          toast({ title: "Error", description: "Quiz not found.", variant: "destructive" });
          router.push('/dashboard');
        });
    }
  }, [user, authLoading, quizId, router, toast]);
  
  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/quiz/${quizId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ title }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update quiz.');
      }

      toast({ title: "✅ Success", description: "Quiz title has been updated!" });
      router.push('/dashboard');
      router.refresh(); // a good practice to refresh dashboard data
    } catch (error: any) {
      toast({ title: "❌ Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin"/>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <DashboardHeader />
      <div className="container mx-auto max-w-2xl py-12 px-4">
        <Button variant="ghost" className="mb-6" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Edit Quiz</CardTitle>
            <CardDescription>Update the title of your quiz.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Quiz Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}