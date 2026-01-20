// src/lib/dashboard-data.ts
import { prisma } from "@/lib/prisma";

// --- Types ---

export type StudyQueueItem = 
  | { type: "flashcard_due"; id: string; title: string; dueCount: number; deckId: string }
  | { type: "low_score_quiz"; id: string; title: string; score: number; quizId: string };

export type HeatmapPoint = {
  date: string; // YYYY-MM-DD
  count: number;
};

export type ActivityItem = {
  id: string;
  type: "document" | "quiz" | "note" | "project";
  title: string;
  date: Date;
  url: string;
};

export type TopicPerformance = {
  topic: string;
  score: number; // 0-100
  fullMark: number; // 100
};

// --- Data Fetching Functions ---

/**
 * 1. Smart Study Queue
 * - Fetches Flashcard Decks that have cards due (review_at <= now).
 * - Fetches Quizzes with recent low scores (< 70%).
 */
export async function getSmartStudyQueue(userId: string) {
  try {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // A. Flashcards Due
    const decksWithDueCards = await prisma.flashcard_decks.findMany({
      where: {
        user_id: userId,
        flashcards: {
          some: {
            review_at: { lte: now },
          },
        },
      },
      include: {
        flashcards: {
          where: { review_at: { lte: now } },
          select: { id: true },
        },
      },
      take: 5,
    }).catch(() => []); // Safety catch

    const flashcardItems: StudyQueueItem[] = (decksWithDueCards || []).map((deck) => ({
      type: "flashcard_due" as const, // FIX: Use as const to match literal type
      id: deck.id,
      title: deck.title,
      dueCount: deck.flashcards?.length || 0,
      deckId: deck.id,
    }));

    // B. Recent Low Quiz Scores (< 70%)
    const recentLowAttempts = await prisma.quiz_attempts.findMany({
      where: {
        user_id: userId,
        created_at: { gte: oneWeekAgo },
      },
      include: {
        quiz: {
          select: { title: true, id: true },
        },
      },
      orderBy: { created_at: "desc" },
      take: 10,
    }).catch(() => []); // Safety catch

    // Filter for scores < 70%
    const lowScoreItems: StudyQueueItem[] = (recentLowAttempts || [])
      .filter((attempt) => {
        const percentage = attempt.total > 0 ? (attempt.score / attempt.total) * 100 : 0;
        return percentage < 70;
      })
      .map((attempt) => ({
        type: "low_score_quiz" as const, // FIX: Use as const to match literal type
        id: attempt.id,
        title: attempt.quiz?.title || "Untitled Quiz",
        score: Math.round((attempt.score / attempt.total) * 100),
        quizId: attempt.quiz?.id || "", // FIX: Ensure quizId is a string, not undefined
      }))
      .slice(0, 3);

    return {
      dueFlashcards: flashcardItems,
      recentLowScores: lowScoreItems,
    };
  } catch (error) {
    console.error("Error in getSmartStudyQueue:", error);
    return { dueFlashcards: [], recentLowScores: [] };
  }
}

/**
 * 2. Heatmap Data
 * Aggregates creation/update timestamps from multiple models to visualize daily activity.
 */
export async function getHeatmapData(userId: string): Promise<HeatmapPoint[]> {
  try {
    const [attempts, notes, documents, flashcards] = await Promise.all([
      prisma.quiz_attempts.findMany({
        where: { user_id: userId },
        select: { created_at: true },
      }).catch(() => []),
      prisma.notes.findMany({
        where: { user_id: userId },
        select: { updated_at: true },
      }).catch(() => []),
      prisma.documents.findMany({
        where: { user_id: userId },
        select: { created_at: true },
      }).catch(() => []),
      prisma.flashcards.findMany({
        where: { deck: { user_id: userId } },
        select: { updated_at: true },
      }).catch(() => []),
    ]);

    const dateMap = new Map<string, number>();

    const processDate = (date: Date | null) => {
      if (!date) return;
      const key = date.toISOString().split("T")[0];
      dateMap.set(key, (dateMap.get(key) || 0) + 1);
    };

    (attempts || []).forEach((a) => processDate(a.created_at));
    (notes || []).forEach((n) => processDate(n.updated_at));
    (documents || []).forEach((d) => processDate(d.created_at));
    (flashcards || []).forEach((f) => processDate(f.updated_at));

    return Array.from(dateMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  } catch (error) {
    console.error("Error in getHeatmapData:", error);
    return [];
  }
}

/**
 * 3. Recent Activity (Mission Log)
 * Merges Documents, Quizzes, Notes, and Projects into a single timeline sorted by date.
 */
export async function getRecentActivity(userId: string): Promise<ActivityItem[]> {
  try {
    const [docs, notes, projects, quizzes] = await Promise.all([
      prisma.documents.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
        take: 5,
        select: { id: true, file_name: true, created_at: true },
      }).catch(() => []),
      prisma.notes.findMany({
        where: { user_id: userId },
        orderBy: { updated_at: "desc" },
        take: 5,
        select: { id: true, title: true, updated_at: true },
      }).catch(() => []),
      prisma.projects.findMany({
        where: { user_id: userId },
        orderBy: { updated_at: "desc" },
        take: 5,
        select: { id: true, title: true, updated_at: true },
      }).catch(() => []),
      prisma.quiz.findMany({
        where: { userId: userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, title: true, createdAt: true },
      }).catch(() => []),
    ]);

    const combined: ActivityItem[] = [
      ...(docs || []).map((d) => ({
        id: d.id,
        type: "document" as const,
        title: d.file_name,
        date: d.created_at || new Date(),
        url: `/documents/${d.id}`,
      })),
      ...(notes || []).map((n) => ({
        id: n.id,
        type: "note" as const,
        title: n.title,
        date: n.updated_at || new Date(),
        url: `/notes/${n.id}`,
      })),
      ...(projects || []).map((p) => ({
        id: p.id,
        type: "project" as const,
        title: p.title,
        date: p.updated_at || new Date(),
        url: `/projects/${p.id}`,
      })),
      ...(quizzes || []).map((q) => ({
        id: q.id,
        type: "quiz" as const,
        title: q.title,
        date: q.createdAt || new Date(),
        url: `/quiz/${q.id}`,
      })),
    ];

    return combined.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);
  } catch (error) {
    console.error("Error in getRecentActivity:", error);
    return [];
  }
}

/**
 * 4. Knowledge Radar
 * Aggregates quiz performance grouped by Quiz Title (serving as "Topic" for now).
 * Returns average score % per topic.
 */
export async function getQuizPerformance(userId: string): Promise<TopicPerformance[]> {
  try {
    const attempts = await prisma.quiz_attempts.findMany({
      where: { user_id: userId },
      include: {
        quiz: {
          select: { title: true },
        },
      },
      orderBy: { created_at: "desc" },
      take: 50, 
    }).catch(() => []);

    const topicStats = new Map<string, { totalScore: number; count: number }>();

    (attempts || []).forEach((attempt) => {
      // Safe access for quiz title
      const topic = attempt.quiz?.title || "Unknown";
      const percentage = attempt.total > 0 ? (attempt.score / attempt.total) * 100 : 0;

      const current = topicStats.get(topic) || { totalScore: 0, count: 0 };
      topicStats.set(topic, {
        totalScore: current.totalScore + percentage,
        count: current.count + 1,
      });
    });

    const results: TopicPerformance[] = [];
    topicStats.forEach((value, key) => {
      results.push({
        topic: key,
        score: Math.round(value.totalScore / value.count),
        fullMark: 100,
      });
    });

    return results.slice(0, 6);
  } catch (error) {
    console.error("Error in getQuizPerformance:", error);
    return [];
  }
}

/**
 * 5. Study Streak Calculator
 * Counts consecutive days of activity ending today or yesterday.
 */
export async function getStudyStreak(userId: string): Promise<number> {
  try {
    // 1. Fetch all distinct dates of activity (optimized select)
    const [attempts, notes, documents, flashcards] = await Promise.all([
      prisma.quiz_attempts.findMany({
        where: { user_id: userId },
        select: { created_at: true },
        orderBy: { created_at: 'desc' }
      }).catch(() => []),
      prisma.notes.findMany({
        where: { user_id: userId },
        select: { updated_at: true },
        orderBy: { updated_at: 'desc' }
      }).catch(() => []),
      prisma.documents.findMany({
        where: { user_id: userId },
        select: { created_at: true },
        orderBy: { created_at: 'desc' }
      }).catch(() => []),
      prisma.flashcards.findMany({
        where: { deck: { user_id: userId } },
        select: { updated_at: true },
        orderBy: { updated_at: 'desc' }
      }).catch(() => []),
    ]);

    // 2. Normalize to YYYY-MM-DD strings
    const activityDates = new Set<string>();
    const addDate = (d: Date | null) => {
      if (d) activityDates.add(d.toISOString().split('T')[0]);
    };

    (attempts || []).forEach(a => addDate(a.created_at));
    (notes || []).forEach(n => addDate(n.updated_at));
    (documents || []).forEach(d => addDate(d.created_at));
    (flashcards || []).forEach(f => addDate(f.updated_at));

    // 3. Count backwards from today
    let streak = 0;
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // If no activity today OR yesterday, streak is broken (return 0)
    if (!activityDates.has(todayStr) && !activityDates.has(yesterdayStr)) {
      return 0;
    }

    // Start checking from today (or yesterday if today is empty but yesterday wasn't)
    let currentDate = activityDates.has(todayStr) ? today : yesterday;

    while (true) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (activityDates.has(dateStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1); // Go back one day
      } else {
        break; // Streak broken
      }
    }

    return streak;
  } catch (error) {
    console.error("Error in getStudyStreak:", error);
    return 0;
  }
}