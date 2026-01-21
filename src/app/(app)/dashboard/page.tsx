// src/app/(app)/dashboard/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth"; 
import { getHeatmapData, getRecentActivity } from "@/lib/dashboard-data";

// Components
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { WelcomeHero } from "@/components/dashboard/WelcomeHero";
import { QuizPerformanceChart } from "@/components/dashboard/QuizPerformanceChart";
import { QuickUploadWidget } from "@/components/dashboard/QuickUploadWidget";
import { SmartStudyQueue } from "@/components/dashboard/SmartStudyQueue";
import { MissionLog } from "@/components/dashboard/MissionLog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

// --- Server-Side Data Fetching ---
async function getDashboardData(userId: string) {
  try {
    // 1. Fetch Core Data in Parallel
    const [heatmap, recentActivity, quizAttempts, decks] = await Promise.all([
      getHeatmapData(userId).catch(() => []),
      getRecentActivity(userId).catch(() => []),
      prisma.quiz_attempts.findMany({
        where: { user_id: userId },
        include: { quiz: { select: { title: true, id: true } } },
        orderBy: { created_at: "desc" },
        take: 10,
      }).catch(() => []),
      // FIX: Changed 'prisma.decks' to 'prisma.flashcard_decks' to match schema.prisma
      prisma.flashcard_decks.findMany({
        where: { user_id: userId },
        take: 3, 
        orderBy: { created_at: "desc" }
      }).catch(() => [])
    ]);

    // 2. Process Stats
    const totalSeconds = 0; // Placeholder if study_sessions not available
    const studyHours = Math.round((totalSeconds / 3600) * 10) / 10;

    // 3. Calculate Streak
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

    // 4. Prepare "Smart Queue" Data
    const recentLowScores = quizAttempts.filter(q => (q.score / q.total) < 0.7).slice(0, 3);
    const dueFlashcards = decks.map(d => ({ deck: d, id: d.id })); // Simplified "Due" logic

    return {
      streak,
      quizAttempts,
      recentActivity,
      smartQueue: {
        recentLowScores,
        dueFlashcards
      }
    };
  } catch (error) {
    console.error("Dashboard Data Error:", error);
    return { 
      streak: 0, 
      quizAttempts: [], 
      recentActivity: [], 
      smartQueue: { recentLowScores: [], dueFlashcards: [] } 
    };
  }
}

export default async function DashboardPage() {
  const user = await requireUser();
  const stats = await getDashboardData(user.id);

  return (
    <div className="min-h-screen bg-background pb-12">
      <DashboardHeader />

      <main className="container max-w-7xl mx-auto p-6 space-y-8">
        
        {/* 1. Hero Section */}
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          <WelcomeHero user={user} streak={stats.streak} />
        </div>

        {/* 2. Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN (Main Content) - Spans 8 cols */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Quick Actions */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-serif font-bold tracking-tight">Quick Actions</h2>
              </div>
              <QuickUploadWidget />
            </section>

            {/* Performance Chart */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-serif font-bold tracking-tight">Performance Overview</h2>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary" asChild>
                  <Link href="/quizzes" className="flex items-center gap-1">
                    View All Quizzes <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
              <Suspense fallback={<Skeleton className="h-[350px] w-full rounded-2xl" />}>
                <QuizPerformanceChart attempts={stats.quizAttempts} />
              </Suspense>
            </section>
          </div>

          {/* RIGHT COLUMN (Sidebar) - Spans 4 cols */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Smart Study Queue */}
            <section className="space-y-4">
              <h2 className="text-xl font-serif font-bold tracking-tight">Recommended Focus</h2>
              <Suspense fallback={<Skeleton className="h-48 w-full rounded-2xl" />}>
                <SmartStudyQueue data={stats.smartQueue} />
              </Suspense>
            </section>

            {/* Mission Log / Timeline */}
            <section className="space-y-4">
              <h2 className="text-xl font-serif font-bold tracking-tight">Recent Activity</h2>
              <div className="rounded-2xl border border-border bg-card/50 p-1">
                <div className="max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                  <MissionLog items={stats.recentActivity} />
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}