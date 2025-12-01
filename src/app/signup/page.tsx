'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

// --- Visual Effects ---
import { SpotlightCursor } from "@/components/landing/SpotlightCursor";

// --- Aurora Background (REVERTED TO PRETTY VALUES) ---
function AuroraBackground() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-zinc-950">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] animate-aurora-1 opacity-50" />
      <div className="absolute top-[20%] right-[-10%] w-[30%] h-[50%] rounded-full bg-blue-500/10 blur-[100px] animate-aurora-2 opacity-40" />
      <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[40%] rounded-full bg-purple-500/15 blur-[120px] animate-aurora-3 opacity-40" />
    </div>
  );
}

function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const { signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

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
          router.push('/documents');
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

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 relative z-10">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
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
          disabled={loading}
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
          disabled={loading}
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
        disabled={loading || message !== ''}
      >
        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Create Account
      </Button>
    </form>
  );
}

export default function SignupPage() {
  return (
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2 font-sans selection:bg-primary/20 bg-background text-foreground">
       <SpotlightCursor />

       {/* LEFT COLUMN: Form */}
       <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
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

      {/* RIGHT COLUMN: Brand & Aurora (Clean & Elegant) */}
      <div className="hidden lg:flex items-center justify-center relative overflow-hidden p-10 flex-col gap-6 text-white bg-zinc-900">
        <AuroraBackground />
        
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