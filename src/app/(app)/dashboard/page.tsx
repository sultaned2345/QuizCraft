// src/app/(app)/dashboard/page.tsx
import { Suspense } from "react";
import { WelcomeHero } from "@/components/dashboard/WelcomeHero";
import { PriorityTargets } from "@/components/dashboard/PriorityTargets";
import { MissionLog } from "@/components/dashboard/MissionLog";
import { StudyHeatmap } from "@/components/dashboard/StudyHeatmap";
import { SkeletonCard } from "@/components/SkeletonCard";

// Server Actions to fetch data
import { getSmartStudyQueue, getHeatmapData, getRecentActivity } from "@/lib/dashboard-data";
import { getUser } from "@/lib/auth"; 

export default async function DashboardPage() {
  const user = await getUser();
  
  // Parallel fetching
  const [queueData, recentItems] = await Promise.all([
    getSmartStudyQueue(user.id),
    getRecentActivity(user.id)
  ]);

  return (
    <div className="space-y-8 pb-10">
      
      {/* 1. Hero Section */}
      <WelcomeHero user={user} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 2. Left Column: Priority Tasks (Directives) */}
        <div className="lg:col-span-2 space-y-8">
          <PriorityTargets data={queueData} />
          
          <div className="mt-8">
             <h2 className="text-xl font-mono font-bold tracking-tight mb-6">ACTIVITY MATRIX</h2>
             <Suspense fallback={<SkeletonCard className="h-[250px] w-full bg-card/40 border-white/5" />}>
               <StudyHeatmapFetcher userId={user.id} />
             </Suspense>
          </div>
        </div>

        {/* 3. Right Column: Recent Log */}
        <div className="lg:col-span-1">
           <MissionLog items={recentItems} />
        </div>
      </div>
    </div>
  );
}

// Wrapper for Suspense
async function StudyHeatmapFetcher({ userId }: { userId: string }) {
  const data = await getHeatmapData(userId);
  return (
    <div className="p-6 rounded-2xl border border-white/10 bg-card/40 backdrop-blur-sm">
        <StudyHeatmap data={data} />
    </div>
  );
}