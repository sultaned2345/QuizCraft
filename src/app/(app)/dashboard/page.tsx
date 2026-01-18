import { getServerSession } from "@/lib/getServerSession";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getSmartStudyQueue,
  getHeatmapData,
  getRecentActivity,
} from "@/lib/dashboard-data";

// Smart Components
import { WelcomeHero } from "@/components/dashboard/WelcomeHero";
import { DailyStudyWidget } from "@/components/dashboard/DailyStudyWidget";
import { PriorityTargets } from "@/components/dashboard/PriorityTargets";
import { QuizPerformanceChart } from "@/components/dashboard/QuizPerformanceChart";
import { StudyHeatmap } from "@/components/dashboard/StudyHeatmap";
import { MissionLog } from "@/components/dashboard/MissionLog";

export const metadata = {
  title: "Dashboard | QuizCraft",
  description: "Your study mission control center.",
};

export default async function DashboardPage() {
  // 1. Authenticate User
  const session = await getServerSession();
  if (!session?.user) {
    return redirect("/login");
  }

  // 2. Fetch All Dashboard Data in Parallel
  const [queueData, heatmapData, recentActivity, quizAttempts] = await Promise.all([
    getSmartStudyQueue(session.user.id),
    getHeatmapData(session.user.id),
    getRecentActivity(session.user.id),
    prisma.quiz_attempts.findMany({
      where: { user_id: session.user.id },
      include: {
        quiz: {
          select: { title: true },
        },
      },
      orderBy: { created_at: "desc" },
      take: 20,
    }),
  ]);

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* 1. Hero Section: Greeting & Status */}
      <section>
        <WelcomeHero user={session.user} />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* === LEFT COLUMN (2/3): Action & Performance === */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* A. Immediate Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Daily Study Plan (Client Fetch) */}
            <DailyStudyWidget />
            
            {/* 2. Priority Directives (Server Data) */}
            <PriorityTargets data={queueData} />
          </div>

          {/* B. Performance Analytics */}
          <section className="space-y-4">
             <div className="flex items-center justify-between px-1">
                <h2 className="text-xl font-semibold tracking-tight">Performance Trends</h2>
             </div>
             <QuizPerformanceChart attempts={quizAttempts} />
          </section>
        </div>

        {/* === RIGHT COLUMN (1/3): Consistency & History === */}
        <div className="space-y-8">
          
          {/* A. Consistency Heatmap */}
          <section>
             <StudyHeatmap data={heatmapData} />
          </section>

          {/* B. Recent Mission Log */}
          <section className="bg-muted/10 rounded-3xl p-6 border border-border/50 h-full min-h-[400px]">
             <MissionLog items={recentActivity} />
          </section>
        </div>
      </div>
    </main>
  );
}