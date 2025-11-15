// src/app/(app)/profile/ProfileClient.tsx
// MODIFIED FILE

'use client';

import { useState } from 'react'; // <-- 1. ADD THIS IMPORT
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, BookCopy, StickyNote, FileText } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface ProfileClientProps {
  user: User; // Receive user from server component
  quizCount: number;
  noteCount: number;
  docCount: number;
}

export function ProfileClient({
  user,
  quizCount,
  noteCount,
  docCount,
}: ProfileClientProps) {
  // We still need useAuth for signOut, but not for user or authLoading
  const { signOut } = useAuth();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false); // <-- This line was causing the error

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    router.push('/');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">My Profile</CardTitle>
          <CardDescription>
            View your account details and statistics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Email Address</h3>
            <p className="text-muted-foreground">{user?.email}</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Your Content</h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <span>
                  {docCount} {docCount === 1 ? 'Document' : 'Documents'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <BookCopy className="h-5 w-5" />
                <span>
                  {quizCount} {quizCount === 1 ? 'Quiz' : 'Quizzes'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StickyNote className="h-5 w-5" />
                <span>
                  {noteCount} {noteCount === 1 ? 'Note' : 'Notes'}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}