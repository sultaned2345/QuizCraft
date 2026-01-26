'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, UserPlus, Sparkles } from 'lucide-react';
import { AuthLayout } from '@/components/AuthLayout';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!agreed) {
        toast({
            variant: "destructive",
            title: "Agreement Required",
            description: "Please agree to the Terms of Service to continue.",
        });
        return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Registration Failed",
          description: error.message,
        });
      } else {
        toast({
          title: "Account Created!",
          description: "Please check your email to verify your account.",
        });
        router.push('/login');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!agreed) {
      toast({
          variant: "destructive",
          title: "Agreement Required",
          description: "Please agree to the Terms of Service to continue.",
      });
      return;
    }

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
          <CardTitle className="text-3xl font-bold tracking-tight flex items-center justify-center gap-2">
            Join QuizCraft <Sparkles className="w-6 h-6 text-yellow-500" />
          </CardTitle>
          <CardDescription className="text-base">
            Turn your study notes into quizzes instantly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-8">
          <form onSubmit={handleSignup} className="space-y-6">
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
                  disabled={loading || googleLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 6 characters"
                  className="pl-10 h-12 text-base"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading || googleLoading}
                />
              </div>
            </div>

            {/* AGREEMENT CHECKBOX */}
            <div className="flex items-start space-x-3 pt-2">
              <Checkbox 
                id="terms" 
                className="mt-1"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="terms"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I agree to the{" "}
                  <Link href="/legal/terms" className="text-primary hover:underline" target="_blank">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/legal/privacy" className="text-primary hover:underline" target="_blank">
                    Privacy Policy
                  </Link>
                  .
                </label>
                <p className="text-[0.8rem] text-muted-foreground">
                  Required to create an account.
                </p>
              </div>
            </div>
            
            <Button 
                type="submit" 
                className="w-full h-12 text-lg font-medium" 
                disabled={loading || googleLoading || !agreed}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <UserPlus className="w-5 h-5 mr-2" />}
              Create Account
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
            disabled={loading || googleLoading || !agreed}
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

        </CardContent>
        <CardFooter className="justify-center pb-8">
          <p className="text-base text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-semibold">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
}