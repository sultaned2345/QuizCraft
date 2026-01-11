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
      totalQuizzes
    ] = await Promise.all([
      getRecentActivity(user.id),
      getHeatmapData(user.id),
      prisma.quiz_attempts.findMany({
        where: { user_id: user.id },
        select: { score: true, total: true }
      }),
      prisma.quiz_attempts.count({ where: { user_id: user.id } })
    ]);

    // 2. Calculate Stats
    
    // XP Calculation: 10 XP per question answered correctly (approx)
    const xp = quizAttempts.reduce((acc, curr) => acc + (curr.score * 10), 0);

    // Mastered Quizzes: Score > 80%
    const quizzesMastered = quizAttempts.filter(q => 
      q.total > 0 && (q.score / q.total) >= 0.8
    ).length;

    // Study Hours (Estimate): 5 mins (0.083 hrs) per quiz attempt + flat time for other actions
    // This is a heuristic. For real tracking, we'd need a timer on the frontend.
    const studyHours = Math.round((totalQuizzes * 5) / 60 * 10) / 10; // Round to 1 decimal

    // Streak Calculation
    // Sort dates descending
    const sortedDates = heatmap
      .map(h => h.date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    let streak = 0;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Check if active today or yesterday to maintain streak
    if (sortedDates.includes(todayStr) || sortedDates.includes(yesterdayStr)) {
        streak = 1; 
        // Simple consecutive check (naive implementation)
        // In a real app, you'd iterate backwards checking for gaps < 24-48h
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
          studyHours,
          xp
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