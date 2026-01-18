// src/app/(app)/dashboard/page.tsx
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth"; 
import { getHeatmapData } from "@/lib/dashboard-data";

// Components
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { WelcomeHero } from "@/components/dashboard/WelcomeHero";
import { DashboardStatsGrid } from "@/components/dashboard/DashboardStatsGrid";
import { StudyTimer } from "@/components/dashboard/StudyTimer";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

// --- Server-Side Data Fetching ---
async function getDashboardData(userId: string) {
  try {
    // 1. Safe Database Access for 'study_sessions'
    // If table missing, fallback immediately
    const studyTimePromise = (prisma as any).study_sessions
      ? (prisma as any).study_sessions.aggregate({
          where: { user_id: userId },
          _sum: { duration_seconds: true },
        })
      : Promise.resolve({ _sum: { duration_seconds: 0 } });

    // 2. Fetch Data in Parallel
    const [heatmap, studyAggregate, quizAttempts] = await Promise.all([
      getHeatmapData(userId).catch(e => {
         console.error("Heatmap fetch failed", e); 
         return []; 
      }),
      studyTimePromise.catch(() => ({ _sum: { duration_seconds: 0 } })),
      prisma.quiz_attempts.findMany({
        where: { user_id: userId },
        select: { score: true, total: true },
      }).catch(() => []),
    ]);

    // 3. Calculate Study Hours
    const totalSeconds = studyAggregate?._sum?.duration_seconds || 0;
    const studyHours = Math.round((totalSeconds / 3600) * 10) / 10;

    // 4. Calculate Mastered Quizzes (>80%)
    const validAttempts = Array.isArray(quizAttempts) ? quizAttempts : [];
    const quizzesMastered = validAttempts.filter(
      (q) => q.total > 0 && q.score / q.total >= 0.8
    ).length;

    // 5. Calculate Streak (CRITICAL FIX: Ensure Array)
    // If getHeatmapData returned undefined/null, default to []
    const validHeatmap = Array.isArray(heatmap) ? heatmap : [];
    
    const sortedDates = validHeatmap
      .map((h) => h.date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let streak = 0;
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (sortedDates.includes(todayStr) || sortedDates.includes(yesterdayStr)) {
      streak = 1;
      let currentDate = new Date(sortedDates[0]);
      for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i]);
        const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 1) {
          streak++;
          currentDate = prevDate;
        } else {
          break;
        }
      }
    }

    return {
      streak,
      studyHours,
      quizzesMastered,
    };
  } catch (error) {
    console.error("CRITICAL: Failed to calculate dashboard data:", error);
    return { streak: 0, studyHours: 0, quizzesMastered: 0 };
  }
}

export default async function DashboardPage() {
  const user = await requireUser();
  const stats = await getDashboardData(user.id);

  return (
    <div className="space-y-8 p-8 pt-6 animate-in fade-in duration-500">
      <DashboardHeader user={user} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 flex flex-col gap-6">
          <WelcomeHero user={user} />
          <Suspense fallback={<Skeleton className="h-32 w-full rounded-xl" />}>
            <DashboardStatsGrid stats={stats} />
          </Suspense>
        </div>

        <div className="col-span-3">
           <StudyTimer />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 space-y-6">
          <h2 className="text-xl font-semibold tracking-tight">Recent Activity</h2>
          <Suspense fallback={<Skeleton className="h-[200px] w-full" />}>
            <RecentActivity />
          </Suspense>
        </div>

        <div className="col-span-3 space-y-6">
           {/* Widgets */}
        </div>
      </div>
    </div>
  );
}