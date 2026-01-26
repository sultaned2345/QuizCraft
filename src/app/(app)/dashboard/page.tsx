// src/app/(app)/dashboard/page.tsx
import { Suspense } from "react";
import { requireUser } from "@/lib/auth"; 
import { 
  getHeatmapData, 
  getRecentActivity, 
  getSmartStudyQueue, 
  getResumeItem,
  calculateStreak 
} from "@/lib/dashboard-data";
import { prisma } from "@/lib/prisma";

// Components
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { WelcomeHero } from "@/components/dashboard/WelcomeHero";
import { QuizPerformanceChart } from "@/components/dashboard/QuizPerformanceChart";
import { QuickActions } from "@/components/dashboard/QuickActions"; 
import { SmartStudyQueue } from "@/components/dashboard/SmartStudyQueue";
import { MissionLog } from "@/components/dashboard/MissionLog";
import { ResumeCard } from "@/components/dashboard/ResumeCard";
import { WidgetErrorBoundary } from "@/components/dashboard/WidgetErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  // 1. Parallel Data Fetching
  const heatmapPromise = getHeatmapData(user.id);
  const queuePromise = getSmartStudyQueue(user.id);
  const resumePromise = getResumeItem(user.id);
  const activityPromise = getRecentActivity(user.id);
  const attemptsPromise = prisma.quiz_attempts.findMany({
    where: { user_id: user.id },
    include: { quiz: { select: { title: true, id: true } } },
    orderBy: { created_at: "desc" },
    take: 10,
  });

  const [
    heatmap,
    smartQueue,
    resumeItem,
    recentActivity,
    quizAttempts
  ] = await Promise.all([
    heatmapPromise,
    queuePromise,
    resumePromise,
    activityPromise,
    attemptsPromise
  ]);

  const streak = calculateStreak(heatmap);

  return (
    <div className="min-h-screen bg-background pb-12">
      <DashboardHeader />

      <main className="container max-w-7xl mx-auto p-4 md:p-6 space-y-8">
        
        {/* 1. Hero & Resume Context */}
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <WidgetErrorBoundary>
             <WelcomeHero user={user} streak={streak} />
          </WidgetErrorBoundary>
          
          {resumeItem && (
            <div className="animate-in fade-in slide-in-from-bottom-2 delay-100 duration-700">
              <ResumeCard data={resumeItem} />
            </div>
          )}
        </div>

        {/* 2. Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN */}
          <div className="lg:col-span-8 space-y-8">
            {/* Quick Actions */}
            <section className="space-y-4">
              <h2 className="text-lg font-serif font-bold tracking-tight">Start Learning</h2>
              <QuickActions />
            </section>

            {/* Performance Chart */}
            <section className="space-y-4">
               <h2 className="text-lg font-serif font-bold tracking-tight">Performance Analytics</h2>
               <WidgetErrorBoundary>
                 <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-2xl" />}>
                    <QuizPerformanceChart attempts={quizAttempts} />
                 </Suspense>
               </WidgetErrorBoundary>
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-4 space-y-8">
            {/* Smart Study Queue */}
            <section className="space-y-4">
              <h2 className="text-lg font-serif font-bold tracking-tight">Recommended Focus</h2>
              <WidgetErrorBoundary>
                <Suspense fallback={<Skeleton className="h-48 w-full rounded-2xl" />}>
                  <SmartStudyQueue data={smartQueue} />
                </Suspense>
              </WidgetErrorBoundary>
            </section>

            {/* Mission Log */}
            <section className="space-y-4">
              <h2 className="text-lg font-serif font-bold tracking-tight">Recent History</h2>
              <WidgetErrorBoundary>
                <div className="rounded-2xl border border-border bg-card/50 p-1">
                  <div className="max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                    <MissionLog items={recentActivity} />
                  </div>
                </div>
              </WidgetErrorBoundary>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}