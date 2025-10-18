'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { supabaseHelpers } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, BookCopy, ArrowLeft } from 'lucide-react';
// Note: You should create a shared DashboardHeader component to use here.
// For now, this page will not have the header.

export default function ProfilePage() {
  const { user, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const [quizCount, setQuizCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    if (user) {
      supabaseHelpers.getQuizzes(user.id).then(quizzes => {
        setQuizCount(quizzes.length);
        setIsLoading(false);
      });
    }
  }, [user, authLoading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* It's recommended to add your <DashboardHeader /> here */}
      <main className="container mx-auto max-w-2xl py-12 px-4">
        <Button variant="ghost" className="mb-6" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">My Profile</CardTitle>
            <CardDescription>View your account details and statistics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Email Address</h3>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Your Stats</h3>
              <div className="flex items-center gap-2 text-muted-foreground">
                <BookCopy className="h-5 w-5" />
                <span>{quizCount} {quizCount === 1 ? 'quiz' : 'quizzes'} created</span>
              </div>
            </div>
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}