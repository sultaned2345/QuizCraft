// src/app/reset-password/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient'; 

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSessionCheckComplete, setIsSessionCheckComplete] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    // Determine if we have a valid session from the recovery link
    const checkSession = async () => {
      // 1. Check if session already exists (e.g. Implicit flow handled by supabase-js)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsSessionCheckComplete(true);
      } else {
        // 2. If not, listen for the recovery event (PKCE flow or delayed processing)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY' || session) {
            setIsSessionCheckComplete(true);
          }
        });
        
        // Cleanup subscription on unmount
        return () => subscription.unsubscribe();
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    
    setLoading(true);

    // With the recovery session active, we can simply update the user
    const { error } = await supabase.auth.updateUser({ password: password });

    if (error) {
      setError(error.message || 'Failed to update password. The link may have expired.');
    } else {
      setMessage('Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        // Sign out to force fresh login with new password, or just redirect
        router.push('/login'); 
      }, 2000);
    }
    
    setLoading(false);
  };

  return (
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2">
      {/* Form Column */}
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-sm gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Set New Password</h1>
            <p className="text-muted-foreground">
              Enter and confirm your new password.
            </p>
          </div>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="6+ characters"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || message !== ''}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading || message !== ''}
              />
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="flex items-start gap-3 rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || message !== ''}
              className="w-full"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Password
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Remembered your password?{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline font-semibold">
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Brand Column */}
      <div className="hidden lg:flex items-center justify-center bg-muted/40 p-10 flex-col gap-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground p-2 rounded-lg">
            <Sparkles className="w-6 h-6" />
          </div>
          <span className="text-3xl font-bold tracking-tight">QuizCraft</span>
        </Link>
        <div className="text-center max-w-md">
          <p className="text-lg italic text-muted-foreground">
            &ldquo;This app is a game-changer for my midterms. I turned a 40-page PDF into a practice quiz in 30 seconds.&rdquo;
          </p>
          <p className="font-semibold text-foreground mt-4">&mdash; Sarah J, University Student</p>
        </div>
      </div>
    </div>
  );
}