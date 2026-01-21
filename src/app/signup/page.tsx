// src/app/signup/page.tsx
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Loader2, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { SpotlightCursor } from "@/components/landing/SpotlightCursor";

function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  // Destructure signOut to clear old sessions
  const { signUp, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // FIX: Force logout when this page mounts to prevent session leakage
  useEffect(() => {
    const clearSession = async () => {
      await signOut();
    };
    clearSession();
  }, [signOut]);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await signUp(email.trim(), password);
      if (error) {
        setError(error.message || 'Failed to create an account. Please try again.');
      } else {
        // FIX: Handle Email Verification logic vs Auto-login
        if (data.session) {
          // If we have a session, safe to redirect
          router.push('/documents');
        } else {
          // If no session (email confirm required), DO NOT redirect to protected route
          // The old bug sent you to /documents here, which loaded the OLD user if not signed out.
          setMessage('Account created! Please check your email to confirm your account before logging in.');
          // Optional: redirect to login after delay
          // setTimeout(() => router.push('/login'), 5000);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to initiate Google login.',
        variant: 'destructive',
      });
      setGoogleLoading(false);
    }
  };

  return (
    <div className="grid gap-6 relative z-10">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || googleLoading}
            required
            className="h-11 bg-background border-border/60"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="6+ characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || googleLoading}
            required
            className="h-11 bg-background border-border/60"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading || googleLoading}
            required
            className="h-11 bg-background border-border/60"
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
          className="w-full h-11 rounded-xl shadow-sm"
          disabled={loading || googleLoading || message !== ''}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Create Account
        </Button>
      </form>

      {/* --- DIVIDER --- */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-muted" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground font-medium">
            Or continue with
          </span>
        </div>
      </div>

      {/* --- GOOGLE BUTTON --- */}
      <Button 
        variant="outline" 
        className="w-full h-11 rounded-xl border-border/60 bg-card hover:bg-muted/50"
        onClick={handleGoogleLogin} 
        disabled={loading || googleLoading}
      >
        {googleLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
            <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
          </svg>
        )}
        Google
      </Button>
    </div>
  );
}

// --- Main Page Layout ---
export default function SignupPage() {
  return (
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2 font-sans bg-background">
       <SpotlightCursor />

       {/* LEFT COLUMN: Form */}
       <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative bg-background">
        <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors z-20">
           <ArrowLeft className="w-4 h-4" /> <span className="text-sm font-medium">Back to Home</span>
        </Link>

        <div className="mx-auto grid w-full max-w-sm gap-8 relative z-10">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-serif font-medium tracking-tight text-foreground">Create an Account</h1>
            <p className="text-muted-foreground">
              Join QuizCraft to start studying smarter.
            </p>
          </div>
          
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>}>
            <SignupForm />
          </Suspense>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline font-semibold">
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Brand */}
      <div className="hidden lg:flex items-center justify-center relative p-10 flex-col gap-6 bg-secondary/20 text-foreground">
        <div className="flex flex-col items-center justify-center max-w-lg text-center">
            <Link href="/" className="flex items-center gap-3 mb-10">
                <div className="bg-primary text-primary-foreground p-3 rounded-xl shadow-sm">
                    <BookOpen className="w-8 h-8" />
                </div>
                <span className="text-4xl font-serif font-medium tracking-tight">QuizCraft</span>
            </Link>
            
            <div className="p-8">
                <p className="text-xl font-serif italic text-foreground/80 leading-relaxed">
                    &ldquo;This app is a game-changer. I turned a 40-page PDF into a practice quiz in 30 seconds.&rdquo;
                </p>
                <div className="flex items-center justify-center gap-4 mt-8">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold font-serif">
                       S
                    </div>
                    <div className="text-left">
                        <p className="font-semibold text-foreground text-lg">Sarah J.</p>
                        <p className="text-sm text-muted-foreground">University Student</p>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}