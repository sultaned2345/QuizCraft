// src/app/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { SpotlightCursor } from "@/components/landing/SpotlightCursor";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await resetPassword(email);
    
    if (error) {
      setError(error.message);
    } else {
      setMessage('If an account with that email exists, we sent a password reset link.');
    }
    
    setLoading(false);
  };

  return (
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2 font-sans">
      <SpotlightCursor />

      {/* LEFT COLUMN: Form */}
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative bg-background">
        <Link href="/login" className="absolute top-8 left-8 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors z-20">
           <ArrowLeft className="w-4 h-4" /> <span className="text-sm font-medium">Back to Login</span>
        </Link>

        <div className="mx-auto grid w-full max-w-sm gap-8 relative z-10">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight">Reset Password</h1>
            <p className="text-muted-foreground">
              Enter your email to receive a recovery link.
            </p>
          </div>

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || message !== ''}
                className="h-11 bg-background"
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
              className="w-full h-11"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Reset Link
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            Remembered your password?{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline font-semibold">
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Brand */}
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
                    &ldquo;QuizCraft helped me organize my thoughts and ace my certifications without the stress.&rdquo;
                </p>
                <div className="flex items-center justify-center gap-4 mt-8">
                    <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <div className="text-left">
                        <p className="font-semibold text-foreground text-lg">Alex M.</p>
                        <p className="text-sm text-muted-foreground">Certified Pro</p>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}