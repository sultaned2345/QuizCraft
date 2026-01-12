// src/app/(app)/account/AccountClient.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useUpgradeModal } from '@/components/UpgradeModalContext';
import { Check, Infinity, Zap, AlertCircle, Loader2, User as UserIcon, Settings, CreditCard, BarChart3, ShieldAlert, LogOut, Laptop } from 'lucide-react';
import { getUserUsage } from '@/lib/usage-limits';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ApiResponse } from '@/types/database';
import { DeleteAccountSection } from '@/components/DeleteAccountSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type UsageData = Awaited<ReturnType<typeof getUserUsage>>;

interface AccountClientProps {
  initialData: UsageData;
  user: {
    id: string;
    email: string;
  };
}

// Helper: Individual Usage Bar
function UsageBar({
  title,
  usage,
  icon: Icon
}: {
  title: string;
  usage: { used: number; limit: number | typeof Infinity };
  icon?: any;
}) {
  const isPro = usage.limit === Infinity;
  const percentage = isPro ? 100 : Math.min(100, (usage.used / (usage.limit || 1)) * 100);
  const isOverLimit = !isPro && usage.used >= usage.limit;

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm items-end">
        <div className="flex items-center gap-2 font-medium text-muted-foreground">
          {Icon && <Icon className="h-4 w-4" />}
          <span>{title}</span>
          {isOverLimit && <AlertCircle className="h-4 w-4 text-destructive" />}
        </div>
        <div className="text-right">
          {isPro ? (
            <span className="flex items-center gap-1 font-medium text-primary text-xs bg-primary/10 px-2 py-0.5 rounded-full">
              <Infinity className="h-3 w-3" /> Unlimited
            </span>
          ) : (
            <span className={cn("text-xs", isOverLimit ? 'font-bold text-destructive' : 'text-muted-foreground')}>
              <span className="text-foreground font-medium">{usage.used}</span> / {usage.limit}
            </span>
          )}
        </div>
      </div>
      <Progress
        value={percentage}
        className={cn('h-2', isOverLimit ? '[&>*]:bg-destructive' : isPro ? '[&>*]:bg-primary/50' : '')}
      />
    </div>
  );
}

export function AccountClient({ initialData, user }: AccountClientProps) {
  const { openModal } = useUpgradeModal();
  const { session, signOut } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // --- STATE ---
  const [plan, setPlan] = useState(initialData.plan);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const { ...usageStats } = initialData;
  const isPro = plan === 'pro';

  const proFeatures = [
    'Unlimited Document Uploads',
    'Unlimited Quizzes & Notes',
    'Unlimited Flashcard Decks',
    'Unlimited AI Generations',
    'AI Essay Grader Access',
    'Priority Support',
  ];

  // --- PLAN TOGGLE HANDLER ---
  const handlePlanChange = async (isChecked: boolean) => {
    const newPlan = isChecked ? 'pro' : 'free';
    setIsUpdatingPlan(true);

    try {
      const response = await fetch('/api/account/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ newPlan })
      });

      const result: ApiResponse = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update plan.');
      }

      setPlan(newPlan);
      toast({ title: 'Plan Updated!', description: `You are now on the ${newPlan} plan.` });
      router.refresh();
    } catch (error: any) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      toast({ title: "Error signing out", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-8 px-4 sm:px-6">
      
      {/* Header Profile Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Account & Settings</h1>
          <p className="text-muted-foreground">
            Manage your subscription, usage limits, and account preferences.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
           <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
             {(user.email?.[0] || 'U').toUpperCase()}
           </div>
           <div>
             <p className="font-medium leading-none">{user.email}</p>
             <p className="text-xs text-muted-foreground mt-1">ID: {user.id.slice(0, 8)}...</p>
           </div>
           <Separator orientation="vertical" className="h-8 mx-2" />
           <Badge variant={isPro ? "default" : "secondary"} className="px-3 py-1">
             {isPro ? "PRO PLAN" : "FREE PLAN"}
           </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="overview" className="gap-2"><BarChart3 className="h-4 w-4"/> Overview</TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2"><CreditCard className="h-4 w-4"/> Subscription</TabsTrigger>
          <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4"/> Settings</TabsTrigger>
        </TabsList>

        {/* --- TAB: OVERVIEW (USAGE) --- */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage Statistics</CardTitle>
              <CardDescription>
                Real-time tracking of your current billing cycle usage.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-8 md:grid-cols-2">
              <div className="space-y-6">
                <h3 className="font-semibold flex items-center gap-2 text-sm text-foreground/80">
                  <Zap className="h-4 w-4 text-yellow-500"/> AI Capabilities
                </h3>
                <UsageBar title="AI Generations (Monthly)" usage={usageStats.aiGenerations} />
                <UsageBar title="Essay Grading" usage={{ used: 0, limit: isPro ? Infinity : 0 }} />
              </div>
              
              <div className="space-y-6">
                <h3 className="font-semibold flex items-center gap-2 text-sm text-foreground/80">
                  <UserIcon className="h-4 w-4 text-blue-500"/> Content Storage
                </h3>
                <UsageBar title="Documents Uploaded" usage={usageStats.documents} />
                <UsageBar title="Quizzes Created" usage={usageStats.quizzes} />
                <UsageBar title="Notes Created" usage={usageStats.notes} />
                <UsageBar title="Flashcard Decks" usage={usageStats.flashcardDecks} />
              </div>
            </CardContent>
            {!isPro && (
              <CardFooter className="bg-muted/50 border-t p-4 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Need more capacity?</span>
                <Button size="sm" onClick={openModal}>Upgrade to Pro</Button>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        {/* --- TAB: SUBSCRIPTION --- */}
        <TabsContent value="subscription" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current Plan Status */}
            <Card className={cn("flex flex-col", isPro ? "border-primary/50 bg-primary/5" : "")}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Pro Plan
                  {isPro && <Check className="h-5 w-5 text-primary" />}
                </CardTitle>
                <CardDescription>For power users who need unlimited access.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {proFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{feature}</span>
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                {isPro ? (
                  <Button variant="outline" className="w-full" disabled>Active Plan</Button>
                ) : (
                   <Button className="w-full" onClick={openModal}>Upgrade Now</Button>
                )}
              </CardFooter>
            </Card>

            {/* Free Plan Status */}
            <Card className={cn("flex flex-col", !isPro ? "border-muted" : "opacity-70")}>
              <CardHeader>
                <CardTitle>Free Plan</CardTitle>
                <CardDescription>Basic access for casual learners.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                 <p className="text-sm text-muted-foreground">Includes basic quiz generation and limited storage.</p>
              </CardContent>
              <CardFooter>
                {!isPro ? (
                   <Button variant="outline" className="w-full" disabled>Current Plan</Button>
                ) : (
                  <Button variant="ghost" className="w-full" onClick={() => handlePlanChange(false)}>Downgrade to Free</Button>
                )}
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* --- TAB: SETTINGS --- */}
        <TabsContent value="settings" className="space-y-6">
          
           {/* Session Management (Moved from Sidebar) */}
           <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Laptop className="h-4 w-4"/> Session Management
              </CardTitle>
              <CardDescription>Manage your current session.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Currently signed in as <span className="font-medium text-foreground">{user.email}</span>
              </div>
              <Button variant="outline" onClick={handleSignOut} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-900">
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </Button>
            </CardContent>
           </Card>

           {/* Developer Tools */}
           <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4"/> Developer Controls
              </CardTitle>
              <CardDescription>Tools for testing subscription states.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-base">Force Pro Status</Label>
                  <p className="text-xs text-muted-foreground">
                    Override your account plan for testing.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isPro}
                    onCheckedChange={handlePlanChange}
                    disabled={isUpdatingPlan}
                  />
                  {isUpdatingPlan && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <div className="pt-4">
             <h3 className="text-lg font-semibold text-destructive mb-4 flex items-center gap-2">
               <ShieldAlert className="h-5 w-5"/> Danger Zone
             </h3>
             <DeleteAccountSection />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}