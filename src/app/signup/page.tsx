// src/app/signup/page.tsx
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient'; // Import for Google Auth
import { useToast } from '@/hooks/use-toast';

// --- Visual Effects ---
import { SpotlightCursor } from "@/components/landing/SpotlightCursor";

// --- Aurora Background (Local) ---
function AuroraBackground() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-zinc-950">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/30 blur-[120px] animate-aurora-1 opacity-80" />
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-blue-500/20 blur-[100px] animate-aurora-2 opacity-70" />
      <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[50%] rounded-full bg-purple-500/25 blur-[120px] animate-aurora-3 opacity-70" />
    </div>
  );
}

// --- Form Component ---
function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const { signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Smart Pre-fill Logic
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
        if (data.session) {
          router.push('/documents'); // Redirect immediately
        } else {
          setMessage('Account created successfully! Redirecting...');
          setTimeout(() => router.push('/documents'), 2000);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- NEW: Google Login Handler ---
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
      // No need to redirect manually; Supabase handles the redirect to Google
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
    <div className="grid gap-4 relative z-10">
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
            className="bg-background/50 backdrop-blur-sm"
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
            className="bg-background/50 backdrop-blur-sm"
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
            className="bg-background/50 backdrop-blur-sm"
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
          className="w-full shadow-lg hover:shadow-primary/20 transition-all"
          disabled={loading || googleLoading || message !== ''}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Create Account
        </Button>
      </form>

      {/* --- DIVIDER --- */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

      {/* --- GOOGLE BUTTON --- */}
      <Button 
        variant="outline" 
        className="w-full bg-background/50 backdrop-blur-sm" 
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
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2 font-sans selection:bg-primary/20">
       <SpotlightCursor />

       {/* LEFT COLUMN: Form */}
       <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative bg-background">
        <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors z-20">
           <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div className="mx-auto grid w-full max-w-sm gap-6 relative z-10">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight">Create an Account</h1>
            <p className="text-muted-foreground">
              Join QuizCraft to start studying smarter.
            </p>
          </div>
          
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>}>
            <SignupForm />
          </Suspense>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline font-semibold">
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Brand & Aurora */}
      <div className="hidden lg:flex items-center justify-center relative overflow-hidden p-10 flex-col gap-6 text-white">
        {/* Background Layer */}
        <div className="absolute inset-0 bg-zinc-900 z-0">
           <AuroraBackground />
        </div>
        
        {/* Glass Overlay for Text */}
        <div className="relative z-10 flex flex-col items-center justify-center max-w-lg text-center">
            <Link href="/" className="flex items-center gap-3 mb-8 group">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 text-white p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-xl">
                    <Sparkles className="w-8 h-8" />
                </div>
                <span className="text-4xl font-bold tracking-tight drop-shadow-md">QuizCraft</span>
            </Link>
            
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl shadow-2xl">
                <p className="text-xl italic text-white/90 leading-relaxed">
                    &ldquo;This app is a game-changer for my midterms. I turned a 40-page PDF into a practice quiz in 30 seconds.&rdquo;
                </p>
                <div className="flex items-center justify-center gap-3 mt-6">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-400 to-blue-400" />
                    <div className="text-left">
                        <p className="font-semibold text-white">Sarah J.</p>
                        <p className="text-sm text-white/60">University Student</p>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}