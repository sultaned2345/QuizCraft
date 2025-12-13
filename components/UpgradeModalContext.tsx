// src/components/UpgradeModalContext.tsx
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
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Check, Zap, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
  id: string;
  title: string;
  price: string;
  period: string;
  billingText: string;
  perMonth?: string;
  savings?: string;
  features: string[];
  isRecommended?: boolean;
  isBestValue?: boolean;
}

// Updated Pricing Model
const plans: Plan[] = [
  {
    id: 'monthly',
    title: 'Monthly',
    price: '$9.99',
    period: '/mo',
    billingText: 'Billed monthly',
    features: [
      'Unlimited Quizzes',
      'Unlimited Documents',
      'AI Chat & Summaries',
      'Basic Support'
    ],
  },
  {
    id: 'quarterly',
    title: 'Quarterly',
    price: '$19.99',
    period: '/qtr',
    billingText: 'Billed every 3 months',
    perMonth: '$6.66/mo',
    savings: 'Save 33%',
    features: [
      'Everything in Monthly',
      'Priority Support',
      'AI Essay Grader',
      'Early Access Features'
    ],
    isRecommended: true,
  },
  {
    id: 'yearly',
    title: 'Yearly',
    price: '$49.99',
    period: '/yr',
    billingText: 'Billed annually',
    perMonth: '$4.17/mo',
    savings: 'Save 58%',
    features: [
      'Everything in Quarterly',
      '2 Months Free',
      'Dedicated Study Plan',
      'Export to Anki/PDF'
    ],
    isBestValue: true,
  },
];

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleUpgradeClick = (planTitle: string) => {
    // Placeholder for Stripe integration
    console.log(`User selected ${planTitle}`);
    alert(`Proceeding to checkout for ${planTitle}...`);
  };

  return (
    <UpgradeModalContext.Provider value={{ openModal: () => setIsOpen(true) }}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-5xl p-0 overflow-hidden bg-background">
          <div className="p-6 md:p-8 bg-muted/30 border-b">
            <DialogHeader>
              <DialogTitle className="text-3xl font-bold text-center flex items-center justify-center gap-2">
                <Zap className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                Unlock Your Full Potential
              </DialogTitle>
              <DialogDescription className="text-center text-lg text-muted-foreground mt-2 max-w-xl mx-auto">
                Remove all limits and get advanced AI features to master your studies faster.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 md:p-8 bg-background">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={cn(
                  'relative flex flex-col transition-all duration-200 hover:shadow-lg',
                  plan.isRecommended ? 'border-primary shadow-md scale-105 z-10' : 'border-border',
                  plan.isBestValue ? 'border-green-500/50' : ''
                )}
              >
                {/* Badges */}
                {plan.isRecommended && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <Badge className="bg-primary hover:bg-primary text-primary-foreground px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}
                {plan.isBestValue && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <Badge className="bg-green-600 hover:bg-green-600 text-white px-4 py-1">
                      Best Value
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <CardTitle className="text-xl text-muted-foreground font-medium">
                    {plan.title}
                  </CardTitle>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground font-normal">{plan.period}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 min-h-[20px]">
                    {plan.perMonth && (
                      <span className="text-primary font-medium">
                        {plan.perMonth}
                      </span>
                    )}
                    {plan.perMonth && plan.billingText && <span className="mx-1">•</span>}
                    {plan.billingText}
                  </div>
                </CardHeader>

                <CardContent className="flex-1">
                  {plan.savings && (
                    <div className="mb-4 inline-block bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold px-2 py-1 rounded-full">
                      {plan.savings}
                    </div>
                  )}
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        <span className="leading-tight">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    className={cn("w-full", plan.isRecommended ? "bg-primary" : "")}
                    variant={plan.isRecommended ? 'default' : 'outline'}
                    onClick={() => handleUpgradeClick(plan.title)}
                  >
                    Choose {plan.title}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </UpgradeModalContext.Provider>
  );
}