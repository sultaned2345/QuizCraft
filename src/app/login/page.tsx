// src/app/login/page.tsx
'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SpotlightCursor } from "@/components/landing/SpotlightCursor";

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.refresh();
      router.push('/dashboard');
    } catch (error: any) {
      setError(error.message || 'Invalid login credentials.');
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
      <form onSubmit={handleLogin} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="student@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || googleLoading}
            required
            className="h-11 bg-background"
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link 
              href="/forgot-password" 
              className="text-xs text-primary hover:underline font-medium"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || googleLoading}
            required
            className="h-11 bg-background"
          />
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11"
          disabled={loading || googleLoading}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Sign In
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
        className="w-full h-11"
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
export default function LoginPage() {
  return (
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2 font-sans">
       <SpotlightCursor />

       {/* LEFT COLUMN: Form */}
       <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative bg-background">
        <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors z-20">
           <ArrowLeft className="w-4 h-4" /> <span className="text-sm font-medium">Back to Home</span>
        </Link>

        <div className="mx-auto grid w-full max-w-sm gap-8 relative z-10">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
            <p className="text-muted-foreground">
              Enter your credentials to access your workspace.
            </p>
          </div>
          
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>}>
            <LoginForm />
          </Suspense>

          <div className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary underline-offset-4 hover:underline font-semibold">
              Sign Up
            </Link>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Brand (Clean Solid) */}
      <div className="hidden lg:flex items-center justify-center relative p-10 flex-col gap-6 bg-muted/40 text-foreground">
        
        <div className="flex flex-col items-center justify-center max-w-lg text-center">
            <Link href="/" className="flex items-center gap-3 mb-10">
                <div className="bg-primary text-primary-foreground p-3 rounded-xl shadow-sm">
                    <Sparkles className="w-8 h-8" />
                </div>
                <span className="text-4xl font-bold tracking-tight">QuizCraft</span>
            </Link>
            
            <div className="p-8">
                <p className="text-xl italic text-muted-foreground leading-relaxed font-light">
                    &ldquo;The AI grading feature saved me hours of manual review. It's like having a TA in your pocket.&rdquo;
                </p>
                <div className="flex items-center justify-center gap-4 mt-8">
                    <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <div className="text-left">
                        <p className="font-semibold text-foreground text-lg">Marcus T.</p>
                        <p className="text-sm text-muted-foreground">Medical Student</p>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}