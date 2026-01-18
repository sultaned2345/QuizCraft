import { getServerSession } from "@/lib/getServerSession";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getSmartStudyQueue,
  getHeatmapData,
  getRecentActivity,
  getStudyStreak, 
} from "@/lib/dashboard-data";

// Smart Components
import { WelcomeHero } from "@/components/dashboard/WelcomeHero";
import { DailyStudyWidget } from "@/components/dashboard/DailyStudyWidget";
import { PriorityTargets } from "@/components/dashboard/PriorityTargets";
import { QuizPerformanceChart } from "@/components/dashboard/QuizPerformanceChart";
import { StudyHeatmap } from "@/components/dashboard/StudyHeatmap";
import { MissionLog } from "@/components/dashboard/MissionLog";
import { QuickUploadWidget } from "@/components/dashboard/QuickUploadWidget";

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
  // We add 'streak' to the Promise.all array to fetch it efficiently
  const [queueData, heatmapData, recentActivity, quizAttempts, streak] = await Promise.all([
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
    getStudyStreak(session.user.id),
  ]);

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* 1. Hero Section: Greeting & Status */}
      <section>
        {/* Pass the calculated streak to the WelcomeHero */}
        {/* Note: Ensure WelcomeHero accepts the 'streak' prop if you haven't updated it yet */}
        <WelcomeHero user={session.user} streak={streak} />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* === LEFT COLUMN (2/3): Action & Performance === */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* A. Immediate Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Quick Upload Widget (Entry point for new study sessions) */}
            <QuickUploadWidget />

            {/* 2. Daily Study Plan (AI Recommendations) */}
            <DailyStudyWidget />
            
            {/* 3. Priority Directives (Urgent tasks - Spans full width) */}
            <div className="md:col-span-2">
              <PriorityTargets data={queueData} />
            </div>
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