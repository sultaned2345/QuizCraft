// src/components/dashboard/QuickActions.tsx
'use client';

import Link from 'next/link';
import { UploadCloud, PenTool, Sparkles, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';

const actions = [
  {
    title: "Upload PDF",
    icon: <UploadCloud className="w-6 h-6" />,
    href: "/upload",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    desc: "Generate quiz from file"
  },
  {
    title: "Paste Text",
    icon: <PenTool className="w-6 h-6" />,
    href: "/notes/new",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    desc: "Paste notes to analyze"
  },
  {
    title: "AI Topic Quiz",
    icon: <Sparkles className="w-6 h-6" />,
    href: "/quiz/create?mode=ai",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    desc: "Generate from topic"
  }
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {actions.map((action) => (
        <Link key={action.title} href={action.href} className="group">
          <Card className="h-full p-4 hover:border-primary/50 transition-all duration-300 hover:shadow-md cursor-pointer flex items-center gap-4">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${action.bg} ${action.color} group-hover:scale-110 transition-transform`}>
              {action.icon}
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                {action.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-tight">
                {action.desc}
              </p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}