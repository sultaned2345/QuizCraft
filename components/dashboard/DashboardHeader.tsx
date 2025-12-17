'use client';

import { User } from 'next-auth'; // Adjust based on your auth types
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface DashboardHeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const router = useRouter();
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {getGreeting()}, {user.name?.split(' ')[0] || 'Scholar'}! 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Here is your daily overview and recommended focus.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={() => router.push('/quiz/new')} className="hidden md:flex">
          <Plus className="mr-2 h-4 w-4" />
          New Quiz
        </Button>
      </div>
    </div>
  );
}