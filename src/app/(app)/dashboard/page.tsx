import { Suspense } from "react";
import { Separator } from "@/components/ui/separator";
import { KnowledgeGraph } from "@/components/dashboard/KnowledgeGraph";
import { DailyStudyWidget } from "@/components/dashboard/DailyStudyWidget";
import { getServerSession } from "@/lib/getServerSession";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your knowledge network and daily tasks.
        </p>
      </div>
      <Separator />

      {/* Top Row: Smart Scheduler */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 lg:col-span-3">
          <DailyStudyWidget />
        </div>
        
        {/* Placeholder for future stats or "Quick Actions" */}
        <div className="col-span-4 lg:col-span-4 flex items-center justify-center bg-muted/10 rounded-xl border border-dashed p-8 text-muted-foreground">
            <p>Recent Activity / Streak Stats placeholder</p>
        </div>
      </div>

      {/* Middle Row: Knowledge Graph (The Brain) */}
      <div className="grid gap-4">
        <h2 className="text-xl font-semibold">Knowledge Graph</h2>
        <Suspense fallback={<div className="h-[500px] w-full bg-muted animate-pulse rounded-xl" />}>
           <KnowledgeGraph />
        </Suspense>
      </div>
    </div>
  );
}