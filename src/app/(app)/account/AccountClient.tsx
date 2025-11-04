// src/app/(app)/account/AccountClient.tsx
// NEW FILE

'use client';

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
import { Check, Infinity, Zap } from 'lucide-react';
import { USAGE_LIMITS, getUserUsage } from '@/lib/usage-limits';
import { cn } from '@/lib/utils'; // <-- ADD THIS LINE

// Get the return type from our helper function
type UsageData = Awaited<ReturnType<typeof getUserUsage>>;

interface AccountClientProps {
  initialData: UsageData;
}

// Helper component for rendering a single usage bar
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
        <span className="font-medium">{title}</span>
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
  const { plan, ...usageStats } = initialData;
  const isPro = plan === 'pro';

  const proFeatures = [
    'Unlimited Document Uploads',
    'Unlimited Quizzes',
    'Unlimited Notes',
    'Unlimited Flashcard Decks',
    'Unlimited AI Generations',
    'AI Essay Grader Access',
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Account & Billing</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Usage Card */}
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

        {/* Plan Card */}
        <Card
          className={cn(
            'flex flex-col',
            isPro
              ? 'border-primary bg-primary/5'
              : 'bg-card'
          )}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Your Plan
              <span
                className={cn(
                  'text-lg font-bold',
                  isPro ? 'text-primary' : 'text-foreground'
                )}
              >
                {isPro ? 'Pro' : 'Free'}
              </span>
            </CardTitle>
            <CardDescription>
              {isPro
                ? 'You have unlimited access to all features.'
                : 'Upgrade to Pro for unlimited access.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            {proFeatures.map((feature) => (
              <div
                key={feature}
                className={cn(
                  'flex items-center gap-2 text-sm',
                  !isPro && 'text-muted-foreground'
                )}
              >
                <Check
                  className={cn(
                    'h-4 w-4',
                    isPro ? 'text-primary' : 'text-muted-foreground/50'
                  )}
                />
                <span>{feature}</span>
              </div>
            ))}
          </CardContent>
          {!isPro && (
            <CardFooter>
              <Button className="w-full" onClick={openModal}>
                <Zap className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}