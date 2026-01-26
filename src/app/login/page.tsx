'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, ArrowRight } from 'lucide-react';
import { AuthLayout } from '@/components/AuthLayout';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: error.message,
        });
        setLoading(false);
      } else {
        setIsRedirecting(true);
        toast({
          title: "Welcome back!",
          description: "Redirecting to your dashboard...",
        });
        router.replace('/dashboard');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "System Error",
        description: "Please try again later.",
      });
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
    <AuthLayout>
      <Card className="w-full max-w-lg border-border/50 bg-card/50 backdrop-blur-sm shadow-xl mx-auto">
        <CardHeader className="space-y-1 text-center pb-8 pt-8">
          <CardTitle className="text-3xl font-bold tracking-tight">Welcome back</CardTitle>
          <CardDescription className="text-base">
            Enter your credentials to access your workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="pl-10 h-12 text-base"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading || googleLoading || isRedirecting}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link 
                  href="/forgot-password" 
                  className="text-sm text-primary hover:text-primary/80 font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  className="pl-10 h-12 text-base"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading || googleLoading || isRedirecting}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 font-medium text-lg transition-all" 
              disabled={loading || googleLoading || isRedirecting}
            >
              {(loading || isRedirecting) ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  {isRedirecting ? 'Redirecting...' : 'Signing in...'}
                </>
              ) : (
                <>
                  Sign In <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground font-medium">
                Or continue with
              </span>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full h-12 text-base"
            onClick={handleGoogleLogin} 
            disabled={loading || googleLoading || isRedirecting}
          >
            {googleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
              </svg>
            )}
            Google
          </Button>

          <p className="text-xs text-center text-muted-foreground px-4">
              By clicking continue, you agree to our{' '}
              <Link href="/legal/terms" className="underline hover:text-foreground">Terms of Service</Link> and{' '}
              <Link href="/legal/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
          </p>

        </CardContent>
        <CardFooter className="flex flex-col gap-4 text-center pb-8">
          <div className="text-base text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary hover:underline font-semibold transition-colors">
              Create one for free
            </Link>
          </div>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
}