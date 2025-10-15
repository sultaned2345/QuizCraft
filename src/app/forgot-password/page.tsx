'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="flex items-center gap-2 mb-8">
        <Sparkles className="w-8 h-8 text-primary" />
        <span className="text-3xl font-bold">QuizCraft</span>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Reset Your Password</CardTitle>
          <CardDescription>Enter your email to get a reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              Send Reset Link
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Remembered your password?{" "}
            <Link href="/login" className="text-primary hover:underline underline-offset-4 font-semibold">
              Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}