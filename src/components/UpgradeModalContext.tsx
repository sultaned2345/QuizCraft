// src/contexts/UpgradeModalContext.tsx
'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpgradeModalContextType {
  openModal: () => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextType | undefined>(
  undefined,
);

export function useUpgradeModal() {
  const context = useContext(UpgradeModalContext);
  if (!context) {
    throw new Error(
      'useUpgradeModal must be used within an UpgradeModalProvider',
    );
  }
  return context;
}

interface Plan {
  title: string;
  price: string;
  period: string;
  priceNote: string;
  features: string[];
  isRecommended?: boolean;
}

const plans: Plan[] = [
  {
    title: 'Monthly',
    price: '$5.99',
    period: '/ month',
    priceNote: 'Billed monthly',
    features: ['Unlimited Quizzes', 'Unlimited Documents', 'Unlimited AI Generations', 'Unlimited Flashcards', 'AI Essay Grader'],
  },
  {
    title: 'Quarterly',
    price: '$15',
    period: '/ 3 months',
    priceNote: 'Billed every 3 months ($5/mo)',
    features: ['Unlimited Quizzes', 'Unlimited Documents', 'Unlimited AI Generations', 'Unlimited Flashcards', 'AI Essay Grader'],
    isRecommended: true,
  },
  {
    title: 'Yearly',
    price: '$50',
    period: '/ year',
    priceNote: 'Billed annually (Best Value)',
    features: ['Unlimited Quizzes', 'Unlimited Documents', 'Unlimited AI Generations', 'Unlimited Flashcards', 'AI Essay Grader'],
  },
];

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  // In a real app, this would redirect to a Stripe checkout session
  const handleUpgradeClick = (planTitle: string) => {
    console.log(`User wants to upgrade to ${planTitle}`);
    // e.g., createCheckoutSession(planTitle);
    alert(`Redirecting to checkout for ${planTitle} plan... (This is a placeholder)`);
  };

  return (
    <UpgradeModalContext.Provider value={{ openModal: () => setIsOpen(true) }}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-4xl p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-3xl font-bold text-center flex items-center justify-center gap-2">
              <Zap className="w-8 h-8 text-yellow-500" />
              Upgrade to QuizCraft Pro
            </DialogTitle>
            <DialogDescription className="text-center text-lg text-muted-foreground pt-2">
              You've reached the limit for the free plan.
              <br />
              Unlock unlimited access to all features.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
            {plans.map((plan) => (
              <Card
                key={plan.title}
                className={cn(
                  'flex flex-col',
                  plan.isRecommended
                    ? 'border-primary border-2 shadow-lg'
                    : '',
                )}
              >
                {plan.isRecommended && (
                  <div className="py-1 px-4 bg-primary text-primary-foreground text-xs font-bold text-center rounded-t-lg">
                    Recommended
                  </div>
                )}
                <CardHeader className="items-center pb-4">
                  <CardTitle className="text-2xl">{plan.title}</CardTitle>
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {plan.priceNote}
                  </p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.isRecommended ? 'default' : 'outline'}
                    onClick={() => handleUpgradeClick(plan.title)}
                  >
                    Upgrade to {plan.title}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </UpgradeModalContext.Provider>
  );
}