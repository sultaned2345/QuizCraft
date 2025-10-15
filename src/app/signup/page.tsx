'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { signUp } = useAuth();

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
      const { error } = await signUp(email.trim(), password);
      if (error) {
        setError(error.message || 'Failed to create an account. Please try again.');
      } else {
        setMessage('Success! Please check your email for a confirmation link.');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="flex items-center gap-2 mb-8">
        <Sparkles className="w-8 h-8 text-primary" />
        <span className="text-3xl font-bold">QuizCraft</span>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
          <CardDescription>Join QuizCraft to start creating quizzes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="you@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="6+ characters" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                placeholder="Re-enter password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required 
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
              className="w-full"
              disabled={loading || message !== ''}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline underline-offset-4 font-semibold">
              Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}