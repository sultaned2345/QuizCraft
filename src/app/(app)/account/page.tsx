// src/app/(app)/account/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Check, Zap, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AccountPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
       {/* Header */}
       <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Subscription Protocol</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upgrade your neural capacity and storage limits.
          </p>
        </div>
        
        <div className="flex items-center p-1 bg-zinc-900 rounded-lg border border-white/5">
            <button 
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${billingCycle === 'monthly' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                Monthly
            </button>
            <button 
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${billingCycle === 'yearly' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                Yearly (-20%)
            </button>
        </div>
      </div>

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Free Plan */}
        <div className="rounded-xl border border-white/5 bg-zinc-900/20 p-8 flex flex-col">
            <div className="mb-4">
                <h3 className="text-lg font-medium text-white">Cadet</h3>
                <div className="text-3xl font-bold mt-2 text-zinc-500">$0</div>
                <p className="text-sm text-zinc-500 mt-1">Forever free for basic training.</p>
            </div>
            <ul className="space-y-3 flex-1 mb-8">
                <li className="flex gap-3 text-sm text-zinc-400">
                    <Check className="w-4 h-4 text-zinc-600" /> 5 Documents / mo
                </li>
                <li className="flex gap-3 text-sm text-zinc-400">
                    <Check className="w-4 h-4 text-zinc-600" /> Basic Quiz Generation
                </li>
                <li className="flex gap-3 text-sm text-zinc-400">
                    <Check className="w-4 h-4 text-zinc-600" /> Standard Support
                </li>
            </ul>
            <Button variant="outline" className="w-full border-white/10 hover:bg-white/5" disabled>
                Current Plan
            </Button>
        </div>

        {/* Pro Plan (Highlighted) */}
        <div className="relative rounded-xl border border-purple-500/50 bg-zinc-900/60 p-8 flex flex-col shadow-[0_0_30px_-10px_rgba(168,85,247,0.15)]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <Badge className="bg-purple-500 hover:bg-purple-600 border-none px-3 py-1">RECOMMENDED</Badge>
            </div>
            <div className="mb-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    Officer <Zap className="w-4 h-4 text-purple-400 fill-purple-400" />
                </h3>
                <div className="text-3xl font-bold mt-2 text-white">
                    {billingCycle === 'monthly' ? '$12' : '$10'}
                    <span className="text-sm font-normal text-zinc-500">/mo</span>
                </div>
                <p className="text-sm text-zinc-400 mt-1">For serious academic optimization.</p>
            </div>
            <ul className="space-y-3 flex-1 mb-8">
                <li className="flex gap-3 text-sm text-zinc-200">
                    <Check className="w-4 h-4 text-purple-400" /> Unlimited Documents
                </li>
                <li className="flex gap-3 text-sm text-zinc-200">
                    <Check className="w-4 h-4 text-purple-400" /> GPT-4 Intelligence
                </li>
                <li className="flex gap-3 text-sm text-zinc-200">
                    <Check className="w-4 h-4 text-purple-400" /> Priority Processing
                </li>
                <li className="flex gap-3 text-sm text-zinc-200">
                    <Check className="w-4 h-4 text-purple-400" /> Audio Transcription
                </li>
            </ul>
            <Button className="w-full bg-white text-black hover:bg-zinc-200 font-bold">
                Upgrade Status
            </Button>
        </div>

         {/* Enterprise Plan */}
         <div className="rounded-xl border border-white/5 bg-zinc-900/20 p-8 flex flex-col">
            <div className="mb-4">
                <h3 className="text-lg font-medium text-white">Commander</h3>
                <div className="text-3xl font-bold mt-2 text-zinc-500">$29</div>
                <p className="text-sm text-zinc-500 mt-1">Maximum power for power users.</p>
            </div>
            <ul className="space-y-3 flex-1 mb-8">
                <li className="flex gap-3 text-sm text-zinc-400">
                    <Check className="w-4 h-4 text-zinc-600" /> Early Access Features
                </li>
                <li className="flex gap-3 text-sm text-zinc-400">
                    <Check className="w-4 h-4 text-zinc-600" /> API Access
                </li>
                <li className="flex gap-3 text-sm text-zinc-400">
                    <Check className="w-4 h-4 text-zinc-600" /> 1-on-1 Support
                </li>
            </ul>
            <Button variant="outline" className="w-full border-white/10 hover:bg-white/5">
                Contact Command
            </Button>
        </div>

      </div>
    </div>
  );
}