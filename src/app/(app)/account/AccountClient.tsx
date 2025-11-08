// src/app/(app)/account/AccountClient.tsx
// MODIFIED FILE

'use client';

import { useState } from 'react'; // <-- ADD
import { useAuth } from '@/contexts/AuthContext'; // <-- ADD
import { useRouter } from 'next/navigation'; // <-- ADD
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
import { Check, Infinity, Zap, AlertCircle, Loader2 } from 'lucide-react'; // <-- ADD Loader2
import { USAGE_LIMITS, getUserUsage } from '@/lib/usage-limits';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch'; // <-- ADD
import { Label } from '@/components/ui/label'; // <-- ADD
import { useToast } from '@/hooks/use-toast'; // <-- ADD
import { ApiResponse } from '@/types/database'; // <-- ADD

// Get the return type from our helper function
type UsageData = Awaited<ReturnType<typeof getUserUsage>>;

interface AccountClientProps {
  initialData: UsageData;
}

// Helper component (unchanged)
function UsageBar({
  title,
  usage,
}: {
  title: string;
  usage: { used: number; limit: number | typeof Infinity };
}) {
  const isPro = usage.limit === Infinity;
  const percentage = isPro ? 100 : (usage.used / (usage.limit || 1)) * 100;
  const isOverLimit = !isPro && usage.used >= usage.limit;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium flex items-center gap-2">
          {isOverLimit && <AlertCircle className="h-4 w-4 text-destructive" />}
          {title}
        </span>
        <span className="text-muted-foreground">
          {isPro ? (
            <span className="flex items-center gap-1 font-medium text-primary">
              <Infinity className="h-4 w-4" /> Unlimited
            </span>
          ) : (
            <>
              <span
                className={cn(isOverLimit ? 'font-bold text-destructive' : '')}
              >
                {usage.used}
              </span>{' '}
              / {usage.limit}
            </>
          )}
        </span>
      </div>
      <Progress
        value={percentage}
        className={cn('h-2', isOverLimit && '[&>*]:bg-destructive')}
      />
    </div>
  );
}

// Main client component for rendering the UI
export function AccountClient({ initialData }: AccountClientProps) {
  const { openModal } = useUpgradeModal();
  const { session } = useAuth(); // <-- ADD
  const { toast } = useToast(); // <-- ADD
  const router = useRouter(); // <-- ADD

  // --- ADDED STATE ---
  const [plan, setPlan] = useState(initialData.plan);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const { ...usageStats } = initialData;
  const isPro = plan === 'pro'; // <-- MODIFIED: Use state
  // ---

  const proFeatures = [
    'Unlimited Document Uploads',
    'Unlimited Quizzes',
    'Unlimited Notes',
    'Unlimited Flashcard Decks',
    'Unlimited AI Generations',
    'AI Essay Grader Access',
  ];

  // --- ADDED HANDLER ---
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

      setPlan(newPlan); // Update local state
      toast({ title: 'Plan Updated!', description: `You are now on the ${newPlan} plan.` });
      router.refresh(); // Force a server-side data refresh
    } catch (error: any) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUpdatingPlan(false);
    }
  };
  // ---

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Usage & Plan</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Usage Card (unchanged) */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Current Usage</CardTitle>
            <CardDescription>
              Your usage quotas for the current plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <UsageBar title="AI Generations (Monthly)" usage={usageStats.aiGenerations} />
            <UsageBar title="Documents" usage={usageStats.documents} />
            <UsageBar title="Quizzes" usage={usageStats.quizzes} />
            <UsageBar title="Notes" usage={usageStats.notes} />
            <UsageBar
              title="Flashcard Decks"
              usage={usageStats.flashcardDecks}
            />
            <UsageBar
              title="Total Flashcards"
              usage={usageStats.flashcards}
            />
          </CardContent>
        </Card>

        {/* Plan Card (modified to use 'isPro' from state) */}
        {isPro ? (
          // --- PRO CARD ---
          <Card
            className="flex flex-col border-primary bg-primary/5"
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Your Plan
                <span
                  className="text-lg font-bold text-primary"
                >
                  Pro
                </span>
              </CardTitle>
              <CardDescription>
                You have unlimited access to all features.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              {proFeatures.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-2 text-sm"
                >
                  <Check
                    className="h-4 w-4 text-green-500"
                  />
                  <span className="text-foreground">{feature}</span>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" disabled>
                {/* This would link to Stripe billing portal */}
                Manage Subscription
              </Button>
            </CardFooter>
          </Card>
        ) : (
          // --- FREE CARD ---
          <Card
            className="flex flex-col"
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Your Plan
                <span
                  className="text-lg font-bold text-foreground"
                >
                  Free
                </span>
              </CardTitle>
              <CardDescription>
                Upgrade to Pro for unlimited access.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              {proFeatures.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Check
                    className="h-4 w-4 text-muted-foreground/50"
                  />
                  <span>{feature}</span>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={openModal}>
                <Zap className="w-4 h-4 mr-2 text-yellow-300" />
                Upgrade to Pro
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>

      {/* --- ADDED TOGGLER CARD --- */}
      <Card>
        <CardHeader>
          <CardTitle>Developer: Plan Toggler</CardTitle>
          <CardDescription>
            For testing purposes, manually toggle your account plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-3">
            <Switch
              id="plan-toggle"
              checked={isPro}
              onCheckedChange={handlePlanChange}
              disabled={isUpdatingPlan}
              aria-label="Toggle plan"
            />
            <Label htmlFor="plan-toggle" className="font-semibold text-base">
              {isPro ? 'Pro Plan' : 'Free Plan'}
            </Label>
            {isUpdatingPlan && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Toggling this will immediately apply the new plan and its limits.
          </p>
        </CardContent>
      </Card>
      {/* --- END ADDED CARD --- */}
    </div>
  );
}