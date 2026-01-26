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

export type ResumeItem = {
  type: 'document' | 'quiz' | 'deck' | 'note';
  title: string;
  id: string;
  timestamp: Date;
  data?: any;
};

// --- Helper Functions ---

/**
 * Calculates the current streak based on heatmap data.
 * Shared logic to be used by both API and UI components.
 */
export function calculateStreak(heatmap: HeatmapPoint[]): number {
  if (!heatmap || heatmap.length === 0) return 0;

  // Extract dates where count > 0
  const activeDates = heatmap
    .filter(h => h.count > 0)
    .map(h => h.date)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  // Unique dates only
  const uniqueDates = Array.from(new Set(activeDates));

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  // If user hasn't studied today OR yesterday, streak is 0
  if (!uniqueDates.includes(todayStr) && !uniqueDates.includes(yesterdayStr)) {
    return 0;
  }

  let streak = 0;
  // Start counting from today or yesterday
  let currentDate = new Date(uniqueDates.includes(todayStr) ? todayStr : yesterdayStr);
  
  while (true) {
    const dateStr = currentDate.toISOString().split("T")[0];
    if (uniqueDates.includes(dateStr)) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// --- Data Fetching Functions ---

/**
 * 1. Resume Context
 * Finds the single most recent interaction to help the user jump back in.
 */
export async function getResumeItem(userId: string): Promise<ResumeItem | null> {
  try {
    const [lastDoc, lastQuiz, lastFlashcard, lastNote] = await Promise.all([
      // Recent Document
      prisma.documents.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        select: { id: true, file_name: true, created_at: true }
      }).catch(() => null),
      
      // Recent Quiz Attempt
      prisma.quiz_attempts.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        include: { quiz: { select: { title: true } } }
      }).catch(() => null),

      // Recent Flashcard Study (approximated by updated_at on cards)
      prisma.flashcards.findFirst({
        where: { deck: { user_id: userId } },
        orderBy: { updated_at: 'desc' },
        include: { deck: { select: { id: true, title: true } } }
      }).catch(() => null),

      // Recent Note
      prisma.notes.findFirst({
        where: { user_id: userId },
        orderBy: { updated_at: 'desc' },
        select: { id: true, title: true, updated_at: true }
      }).catch(() => null)
    ]);

    const candidates = [
      lastDoc ? { type: 'document', date: lastDoc.created_at, data: lastDoc, title: lastDoc.file_name, id: lastDoc.id } : null,
      lastQuiz ? { type: 'quiz', date: lastQuiz.created_at, data: lastQuiz, title: lastQuiz.quiz?.title || 'Quiz', id: lastQuiz.quiz_id } : null,
      lastFlashcard ? { type: 'deck', date: lastFlashcard.updated_at, data: lastFlashcard, title: lastFlashcard.deck?.title || 'Flashcards', id: lastFlashcard.deck_id } : null,
      lastNote ? { type: 'note', date: lastNote.updated_at, data: lastNote, title: lastNote.title, id: lastNote.id } : null
    ].filter(Boolean) as (ResumeItem & { date: Date })[];

    if (candidates.length === 0) return null;

    // Sort by most recent
    candidates.sort((a, b) => b.date.getTime() - a.date.getTime());

    const winner = candidates[0];
    return {
      type: winner.type as ResumeItem['type'],
      title: winner.title,
      id: winner.id,
      timestamp: winner.date,
      data: winner.data
    };
  } catch (error) {
    console.error("Error in getResumeItem:", error);
    return null;
  }
}

/**
 * 2. Smart Study Queue
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
    }).catch(() => []); 

    const flashcardItems: StudyQueueItem[] = (decksWithDueCards || []).map((deck) => ({
      type: "flashcard_due" as const, 
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
    }).catch(() => []);

    // Filter for scores < 70%
    const lowScoreItems: StudyQueueItem[] = (recentLowAttempts || [])
      .filter((attempt) => {
        const percentage = attempt.total > 0 ? (attempt.score / attempt.total) * 100 : 0;
        return percentage < 70;
      })
      .map((attempt) => ({
        type: "low_score_quiz" as const,
        id: attempt.id,
        title: attempt.quiz?.title || "Untitled Quiz",
        score: Math.round((attempt.score / attempt.total) * 100),
        quizId: attempt.quiz?.id || "",
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
 * 3. Heatmap Data
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
 * 4. Recent Activity (Mission Log)
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
 * 5. Knowledge Radar
 * Aggregates quiz performance grouped by Quiz Title.
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
 * 6. Legacy Study Streak
 * Kept for backward compatibility, but internally uses getHeatmapData + calculateStreak logic pattern.
 */
export async function getStudyStreak(userId: string): Promise<number> {
  const heatmap = await getHeatmapData(userId);
  return calculateStreak(heatmap);
}