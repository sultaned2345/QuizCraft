import { Suspense } from "react";
import { SmartStudyQueue } from "@/components/dashboard/SmartStudyQueue";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StudyHeatmap } from "@/components/dashboard/StudyHeatmap";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { SkeletonCard } from "@/components/SkeletonCard";

// Server Actions to fetch data
import { getSmartStudyQueue, getHeatmapData, getRecentActivity } from "@/lib/dashboard-data";
import { getUser } from "@/lib/auth"; // Your auth helper

export default async function DashboardPage() {
  const user = await getUser();
  
  // Parallel data fetching for critical top-fold items
  const queueData = await getSmartStudyQueue(user.id);
  const recentItems = await getRecentActivity(user.id);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <DashboardHeader user={user} />

      {/* Top Row: Immediate Actions & Recents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivity items={recentItems} />
        </div>
        <div className="lg:col-span-1">
           <SmartStudyQueue data={queueData} />
        </div>
      </div>

      {/* Middle Row: Analytics (Lazy Loaded) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Suspense fallback={<SkeletonCard className="h-[300px]" />}>
          <StudyHeatmapFetcher userId={user.id} />
        </Suspense>
        <Suspense fallback={<SkeletonCard className="h-[300px]" />}>
          {/* Add the Radar Chart here later */}
          <QuizPerformanceFetcher userId={user.id} />
        </Suspense>
      </div>
    </div>
  );
}

// Wrapper component to handle async fetching for Suspense
async function StudyHeatmapFetcher({ userId }: { userId: string }) {
  const data = await getHeatmapData(userId);
  return <StudyHeatmap data={data} />;
}