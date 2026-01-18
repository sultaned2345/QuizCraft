// src/app/api/dashboard/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getRecentActivity, getHeatmapData } from '@/lib/dashboard-data';
import { ApiResponse } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    // 1. Fetch Key Metrics in Parallel
    const [
      recentActivity,
      heatmap,
      quizAttempts,
      studySessionsAggregate
    ] = await Promise.all([
      getRecentActivity(user.id),
      getHeatmapData(user.id),
      prisma.quiz_attempts.findMany({
        where: { user_id: user.id },
        select: { score: true, total: true }
      }),
      // Aggregate real study time
      prisma.study_sessions.aggregate({
        where: { user_id: user.id },
        _sum: { duration_seconds: true }
      })
    ]);

    // 2. Calculate Stats
    
    // Mastered Quizzes: Score > 80%
    const quizzesMastered = quizAttempts.filter(q => 
      q.total > 0 && (q.score / q.total) >= 0.8
    ).length;

    // Study Hours (Real Tracking)
    const totalSeconds = studySessionsAggregate._sum.duration_seconds || 0;
    const studyHours = Math.round((totalSeconds / 3600) * 10) / 10;

    // Streak Calculation
    const sortedDates = heatmap
      .map(h => h.date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    let streak = 0;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

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

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        stats: {
          streak,
          quizzesMastered,
          studyHours
          // XP removed
        },
        recentActivity
      }
    });

  } catch (error: any) {
    console.error('[API /dashboard/stats] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to load dashboard stats.' },
      { status: 500 }
    );
  }
}