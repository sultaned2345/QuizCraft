'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '@/components/AuthLayout';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Request Failed",
          description: error.message,
        });
      } else {
        setSubmitted(true);
        toast({
          title: "Email Sent",
          description: "Check your inbox for the reset link.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthLayout>
        <Card className="w-full max-w-lg border-border/50 bg-card/50 backdrop-blur-sm shadow-xl mx-auto">
           <CardContent className="pt-10 pb-10 flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-2">
                 <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-bold">Check your email</h2>
              <p className="text-muted-foreground max-w-sm text-lg">
                We've sent a password reset link to <span className="font-medium text-foreground">{email}</span>
              </p>
              <Button variant="outline" className="mt-6 h-11" onClick={() => setSubmitted(false)}>
                Try another email
              </Button>
              <Link href="/login" className="text-base text-primary hover:underline mt-4 block font-medium">
                Back to Sign In
              </Link>
           </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Card className="w-full max-w-lg border-border/50 bg-card/50 backdrop-blur-sm shadow-xl mx-auto">
        <CardHeader className="space-y-1 text-center pb-8 pt-8">
          <CardTitle className="text-3xl font-bold">Reset Password</CardTitle>
          <CardDescription className="text-base">
            Enter your email and we'll send you a recovery link
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8">
          <form onSubmit={handleReset} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="pl-10 h-12 text-base"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Send Reset Link
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center pb-8">
          <Link 
            href="/login" 
            className="text-base text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Sign In
          </Link>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
}